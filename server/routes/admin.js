import { Router } from 'express';
import db from '../db.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';
import { uploadShoutout } from '../cloudinary.js';
import { getPagination, setPaginationHeaders } from '../utils/pagination.js';

const router = Router();

async function createSystemNotification({ type, message, referenceId = null, excludeUserId = null, expiresInDays = null }) {
    const expiresAt = expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

    await db.prepare(`
        INSERT INTO system_notifications (type, message, reference_id, exclude_user_id, expires_at)
        VALUES (?, ?, ?, ?, ?)
    `).run(type, message, referenceId, excludeUserId, expiresAt);
}

// GET /api/admin/stats
router.get('/stats', verifyToken, requireAdmin, async (req, res) => {
    try {
        const totalUsers = (await db.prepare('SELECT COUNT(*) as c FROM users').get()).c;
        const totalQuizzes = (await db.prepare('SELECT COUNT(*) as c FROM quizzes WHERE status = ?').get('approved')).c;
        const totalAttempts = (await db.prepare('SELECT COUNT(*) as c FROM attempts').get()).c;
        const pendingQuizzes = (await db.prepare('SELECT COUNT(*) as c FROM quizzes WHERE status = ?').get('pending')).c;
        const totalCourses = (await db.prepare('SELECT COUNT(*) as c FROM courses').get()).c;
        const openSuggestions = (await db.prepare('SELECT COUNT(*) as c FROM suggestions WHERE status = ?').get('open')).c;

        res.json({ totalUsers, totalQuizzes, totalAttempts, pendingQuizzes, totalCourses, openSuggestions });
    } catch (err) {
        console.error('Admin stats error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/admin/users
router.get('/users', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { search = '' } = req.query;
        const { page, limit, offset } = getPagination(req.query, { defaultLimit: 25, maxLimit: 100 });
        const filters = [];
        const params = [];

        if (search.trim()) {
            filters.push('(display_name ILIKE ? OR matric_no ILIKE ?)');
            params.push(`%${search.trim()}%`, `%${search.trim()}%`);
        }

        const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
        const countRow = await db.prepare(`
            SELECT COUNT(*) as count
            FROM users
            ${whereClause}
        `).get(...params);

        const users = await db.prepare(`
            SELECT id, matric_no, display_name, role, is_first_login, created_at,
              (SELECT COUNT(*) FROM attempts WHERE user_id = users.id) as quiz_attempts,
              EXISTS (
                SELECT 1
                FROM pending_role_changes prc
                WHERE prc.user_id = users.id
                  AND prc.status = 'pending'
                  AND prc.new_role = 'admin'
              ) as pending_admin
            FROM users
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `).all(...params, limit, offset);

        setPaginationHeaders(res, {
            page,
            limit,
            total: countRow ? Number(countRow.count) : 0,
        });
        res.json(users);
    } catch (err) {
        console.error('Admin users error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/admin/users/:id/role
router.put('/users/:id/role', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { role } = req.body;
        if (!['admin', 'student'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        const target = await db.prepare('SELECT id, role, display_name, matric_no FROM users WHERE id = ?').get(req.params.id);
        if (!target) return res.status(404).json({ error: 'User not found' });

        if (role === 'admin' && target.role === 'student') {
            // Promotion: create pending role change
            // Cancel any existing pending promotions for this user
            await db.prepare("UPDATE pending_role_changes SET status = 'declined' WHERE user_id = ? AND status = 'pending'").run(target.id);

            const pendingRes = await db.prepare('INSERT INTO pending_role_changes (user_id, new_role, requested_by) VALUES (?, ?, ?)').run(target.id, 'admin', req.user.id);

            await db.prepare('INSERT INTO notifications (user_id, type, message, reference_id) VALUES (?, ?, ?, ?)').run(
                target.id, 'role_promotion', 'You have been invited to become an administrator.', pendingRes.lastInsertRowid
            );
            res.json({ message: `Admin invitation sent to ${target.display_name || target.matric_no}` });

        } else if (role === 'student' && target.role === 'admin') {
            // Demotion: immediate
            await db.prepare('UPDATE users SET role = ? WHERE id = ?').run('student', target.id);
            await db.prepare("UPDATE pending_role_changes SET status = 'declined' WHERE user_id = ? AND status = 'pending'").run(target.id);

            await db.prepare('INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)').run(
                target.id, 'role_demotion', 'Your administrator access has been revoked.'
            );
            res.json({ message: `${target.display_name || target.matric_no} demoted to student` });

        } else {
            res.json({ message: 'No role change needed' });
        }
    } catch (err) {
        console.error('Admin role change error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/admin/users/:id/reset-password
router.put('/users/:id/reset-password', verifyToken, requireAdmin, async (req, res) => {
    try {
        const user = await db.prepare('SELECT matric_no FROM users WHERE id = ?').get(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const defaultPass = user.matric_no.slice(-4);
        await db.prepare('UPDATE users SET password = ?, is_first_login = 1 WHERE id = ?').run(defaultPass, req.params.id);
        res.json({ message: 'Password reset to default' });
    } catch (err) {
        console.error('Admin reset password error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const user = await db.prepare('SELECT id, display_name, matric_no, role FROM users WHERE id = ?').get(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Prevent deleting the last admin
        const adminCount = await db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('admin');
        if (user.role === 'admin' && adminCount.count <= 1) {
            return res.status(400).json({ error: 'Cannot delete the last admin user' });
        }

        // Delete user (cascading deletes will handle related data)
        await db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);

        res.json({ message: `User ${user.display_name || user.matric_no} deleted successfully` });
    } catch (err) {
        console.error('Admin delete user error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/admin/allowed-matrics
router.get('/allowed-matrics', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { search = '' } = req.query;
        const { page, limit, offset } = getPagination(req.query, { defaultLimit: 50, maxLimit: 200 });
        const filters = [];
        const params = [];

        if (search.trim()) {
            filters.push('am.matric_no ILIKE ?');
            params.push(`%${search.trim()}%`);
        }

        const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
        const countRow = await db.prepare(`
            SELECT COUNT(*) as count
            FROM allowed_matrics am
            ${whereClause}
        `).get(...params);

        const matrics = await db.prepare(`
            SELECT am.*, u.display_name as added_by_name
            FROM allowed_matrics am
            LEFT JOIN users u ON am.added_by = u.id
            ${whereClause}
            ORDER BY am.matric_no ASC
            LIMIT ? OFFSET ?
        `).all(...params, limit, offset);

        setPaginationHeaders(res, {
            page,
            limit,
            total: countRow ? Number(countRow.count) : 0,
        });
        res.json(matrics);
    } catch (err) {
        console.error('Admin allowed matrics error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/admin/allowed-matrics
router.post('/allowed-matrics', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { matric_no, range_start, range_end, prefix } = req.body;

        if (matric_no) {
            // Single matric number
            await db.prepare('INSERT OR IGNORE INTO allowed_matrics (matric_no, added_by) VALUES (?, ?)').run(matric_no, req.user.id);
            return res.status(201).json({ message: `Added ${matric_no}` });
        }

        if (range_start !== undefined && range_end !== undefined && prefix) {
            // Range: e.g. prefix="CSC/2023/", start=1, end=150
            const added = [];
            for (let i = range_start; i <= range_end; i++) {
                const num = String(i).padStart(3, '0');
                const matricNo = `${prefix}${num}`;
                await db.prepare('INSERT OR IGNORE INTO allowed_matrics (matric_no, added_by) VALUES (?, ?)').run(matricNo, req.user.id);
                added.push(matricNo);
            }
            return res.status(201).json({ message: `Added ${added.length} matric numbers`, sample: added.slice(0, 5) });
        }

        res.status(400).json({ error: 'Provide matric_no or range_start/range_end/prefix' });
    } catch (err) {
        console.error('Admin add matrics error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/admin/allowed-matrics/:id
router.delete('/allowed-matrics/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        await db.prepare('DELETE FROM allowed_matrics WHERE id = ?').run(req.params.id);
        res.json({ message: 'Removed from whitelist' });
    } catch (err) {
        console.error('Admin delete matric error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/admin/quizzes/:id/approve
router.put('/quizzes/:id/approve', verifyToken, requireAdmin, async (req, res) => {
    try {
        const quiz = await db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.id);
        if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

        await db.prepare('UPDATE quizzes SET status = ? WHERE id = ?').run('approved', req.params.id);

        // Notify creator
        await db.prepare(
            'INSERT INTO notifications (user_id, type, message, reference_id) VALUES (?, ?, ?, ?)'
        ).run(quiz.created_by, 'quiz_approved', `Your quiz "${quiz.title}" has been approved!`, quiz.id);

        // Achievement check
        await db.prepare('INSERT OR IGNORE INTO achievements (user_id, badge_type) VALUES (?, ?)').run(quiz.created_by, 'quiz_creator');

        res.json({ message: 'Quiz approved' });
    } catch (err) {
        console.error('Admin approve quiz error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/admin/quizzes/:id/reject
router.put('/quizzes/:id/reject', verifyToken, requireAdmin, async (req, res) => {
    try {
        const quiz = await db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.id);
        if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

        await db.prepare('UPDATE quizzes SET status = ? WHERE id = ?').run('rejected', req.params.id);

        await db.prepare(
            'INSERT INTO notifications (user_id, type, message, reference_id) VALUES (?, ?, ?, ?)'
        ).run(quiz.created_by, 'quiz_rejected', `Your quiz "${quiz.title}" was not approved.`, quiz.id);

        res.json({ message: 'Quiz rejected' });
    } catch (err) {
        console.error('Admin reject quiz error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/admin/pending-quizzes
router.get('/pending-quizzes', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { page, limit, offset } = getPagination(req.query, { defaultLimit: 10, maxLimit: 100 });
        const countRow = await db.prepare(`
            SELECT COUNT(*) as count
            FROM quizzes
            WHERE status = 'pending'
        `).get();

        const quizzes = await db.prepare(`
            SELECT q.*, c.course_code, c.course_name, u.display_name as creator_name, u.matric_no as creator_matric,
              (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count
            FROM quizzes q
            JOIN courses c ON q.course_id = c.id
            LEFT JOIN users u ON q.created_by = u.id
            WHERE q.status = 'pending'
            ORDER BY q.created_at ASC
            LIMIT ? OFFSET ?
        `).all(limit, offset);

        setPaginationHeaders(res, {
            page,
            limit,
            total: countRow ? Number(countRow.count) : 0,
        });

        res.json(quizzes.map(q => ({ ...q, tags: JSON.parse(q.tags || '[]') })));
    } catch (err) {
        console.error('Admin pending quizzes error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/admin/shoutouts — public (any authenticated user), returns active shoutouts within 7 days
router.get('/shoutouts', verifyToken, async (req, res) => {
    try {
        const { limit } = getPagination(req.query, { defaultLimit: 20, maxLimit: 50 });
        const rows = await db.prepare(`
            WITH base AS (
                SELECT id, display_name, matric_no, dob, shoutout_url, instagram, twitter, dob::date AS dob_date
                FROM users
                WHERE dob IS NOT NULL
                  AND dob != ''
                  AND shoutout_url IS NOT NULL
                  AND shoutout_url != ''
            ),
            ranked AS (
                SELECT *,
                    CASE
                        WHEN make_date(
                            EXTRACT(YEAR FROM CURRENT_DATE)::int,
                            EXTRACT(MONTH FROM dob_date)::int,
                            EXTRACT(DAY FROM dob_date)::int
                        ) < CURRENT_DATE
                        THEN (make_date(
                            EXTRACT(YEAR FROM CURRENT_DATE)::int,
                            EXTRACT(MONTH FROM dob_date)::int,
                            EXTRACT(DAY FROM dob_date)::int
                        ) + INTERVAL '1 year')::date
                        ELSE make_date(
                            EXTRACT(YEAR FROM CURRENT_DATE)::int,
                            EXTRACT(MONTH FROM dob_date)::int,
                            EXTRACT(DAY FROM dob_date)::int
                        )
                    END AS next_birthday
                FROM base
            )
            SELECT
                id, display_name, matric_no, dob, shoutout_url, instagram, twitter,
                (next_birthday - CURRENT_DATE) AS days_until,
                ((next_birthday - CURRENT_DATE) = 0) AS is_today
            FROM ranked
            WHERE (next_birthday - CURRENT_DATE) <= 7
            ORDER BY days_until ASC
            LIMIT ?
        `).all(limit);

        res.json(rows.map(row => ({
            ...row,
            days_until: Number(row.days_until),
            is_today: row.is_today === true || row.is_today === 1,
        })));
    } catch (err) {
        console.error('Shoutouts error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/admin/birthdays
router.get('/birthdays', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { search = '' } = req.query;
        const { page, limit, offset } = getPagination(req.query, { defaultLimit: 100, maxLimit: 200 });
        const filters = ["dob IS NOT NULL", "dob != ''"];
        const params = [];

        if (search.trim()) {
            filters.push('(display_name ILIKE ? OR matric_no ILIKE ?)');
            params.push(`%${search.trim()}%`, `%${search.trim()}%`);
        }

        const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
        const countRow = await db.prepare(`
            SELECT COUNT(*) as count
            FROM users
            ${whereClause}
        `).get(...params);

        const rows = await db.prepare(`
            WITH base AS (
                SELECT
                    id, display_name, matric_no, dob, birthday_pic_url, shoutout_url, instagram, twitter, dob::date AS dob_date
                FROM users
                ${whereClause}
            ),
            ranked AS (
                SELECT *,
                    CASE
                        WHEN make_date(
                            EXTRACT(YEAR FROM CURRENT_DATE)::int,
                            EXTRACT(MONTH FROM dob_date)::int,
                            EXTRACT(DAY FROM dob_date)::int
                        ) < CURRENT_DATE
                        THEN (make_date(
                            EXTRACT(YEAR FROM CURRENT_DATE)::int,
                            EXTRACT(MONTH FROM dob_date)::int,
                            EXTRACT(DAY FROM dob_date)::int
                        ) + INTERVAL '1 year')::date
                        ELSE make_date(
                            EXTRACT(YEAR FROM CURRENT_DATE)::int,
                            EXTRACT(MONTH FROM dob_date)::int,
                            EXTRACT(DAY FROM dob_date)::int
                        )
                    END AS next_birthday
                FROM base
            )
            SELECT
                id, display_name, matric_no, dob, birthday_pic_url, shoutout_url, instagram, twitter,
                (next_birthday - CURRENT_DATE) AS days_until,
                ((next_birthday - CURRENT_DATE) = 0) AS is_today
            FROM ranked
            ORDER BY days_until ASC, display_name ASC
            LIMIT ? OFFSET ?
        `).all(...params, limit, offset);

        setPaginationHeaders(res, {
            page,
            limit,
            total: countRow ? Number(countRow.count) : 0,
        });

        res.json(rows.map(row => ({
            ...row,
            days_until: Number(row.days_until),
            is_today: row.is_today === true || row.is_today === 1,
        })));
    } catch (err) {
        console.error('Admin birthdays error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/admin/birthdays/:id/shoutout — upload designed shoutout card for a user
router.post('/birthdays/:id/shoutout', verifyToken, requireAdmin, uploadShoutout.single('shoutout'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const url = req.file.path;
        await db.prepare('UPDATE users SET shoutout_url = ? WHERE id = ?').run(url, req.params.id);

        // Get celebrant info
        const celebrant = await db.prepare('SELECT id, display_name, matric_no FROM users WHERE id = ?').get(req.params.id);
        const name = celebrant?.display_name || celebrant?.matric_no || 'Someone';

        // Notify the celebrant personally
        await db.prepare('INSERT INTO notifications (user_id, type, message, reference_id) VALUES (?, ?, ?, ?)').run(
            celebrant.id, 'birthday_shoutout', `🎉 Your birthday shoutout is live! Happy Birthday, ${name}!`, celebrant.id
        );

        await createSystemNotification({
            type: 'birthday_shoutout',
            message: `🎂 It's ${name}'s birthday! Check out their shoutout on the dashboard.`,
            referenceId: celebrant.id,
            excludeUserId: celebrant.id,
            expiresInDays: 14,
        });

        res.json({ shoutout_url: url });
    } catch (err) {
        console.error('Admin shoutout upload error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/admin/birthdays/:id/shoutout — remove shoutout card
router.delete('/birthdays/:id/shoutout', verifyToken, requireAdmin, async (req, res) => {
    try {
        await db.prepare("UPDATE users SET shoutout_url = '' WHERE id = ?").run(req.params.id);
        res.json({ message: 'Shoutout removed' });
    } catch (err) {
        console.error('Admin shoutout delete error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
