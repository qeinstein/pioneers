import { Router } from 'express';
import db from '../db.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

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
        const users = await db.prepare(`
      SELECT id, matric_no, display_name, role, is_first_login, created_at,
        (SELECT COUNT(*) FROM attempts WHERE user_id = users.id) as quiz_attempts
      FROM users
      ORDER BY created_at DESC
    `).all();
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
        const matrics = await db.prepare(`
      SELECT am.*, u.display_name as added_by_name
      FROM allowed_matrics am
      LEFT JOIN users u ON am.added_by = u.id
      ORDER BY am.matric_no ASC
    `).all();
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
        const quizzes = await db.prepare(`
      SELECT q.*, c.course_code, c.course_name, u.display_name as creator_name, u.matric_no as creator_matric,
        (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count
      FROM quizzes q
      JOIN courses c ON q.course_id = c.id
      LEFT JOIN users u ON q.created_by = u.id
      WHERE q.status = 'pending'
      ORDER BY q.created_at ASC
    `).all();

        res.json(quizzes.map(q => ({ ...q, tags: JSON.parse(q.tags || '[]') })));
    } catch (err) {
        console.error('Admin pending quizzes error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
