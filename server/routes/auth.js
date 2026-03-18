import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import { verifyToken, JWT_SECRET } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimit.js';
import { uploadAvatar, uploadBirthdayPic } from '../cloudinary.js';

const upload = uploadAvatar;

const router = Router();

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
    try {
        const { matric_no, password } = req.body;
        if (!matric_no || !password) {
            return res.status(400).json({ error: 'Matric number and password are required' });
        }

        const user = await db.prepare('SELECT * FROM users WHERE matric_no = ?').get(matric_no);

        if (!user) {
            return res.status(401).json({ error: 'Invalid matric number or password' });
        }

        if (user.password !== password) {
            return res.status(401).json({ error: 'Invalid matric number or password' });
        }

        const token = jwt.sign(
            { id: user.id, matric_no: user.matric_no, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Track session
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const ua = req.headers['user-agent'] || 'Unknown';
        const device = parseDevice(ua);
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'Unknown';

        await db.prepare(
            'INSERT INTO sessions (user_id, token_hash, device, ip_address) VALUES (?, ?, ?, ?)'
        ).run(user.id, tokenHash, device, ip);

        res.json({
            token,
            user: {
                id: user.id,
                matric_no: user.matric_no,
                username: user.username || null,
                display_name: user.display_name,
                bio: user.bio,
                dob: user.dob || null,
                profile_pic_url: user.profile_pic_url,
                role: user.role,
                is_first_login: user.is_first_login === 1,
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/auth/register (self-registration if matric is whitelisted)
router.post('/register', async (req, res) => {
    try {
        const { matric_no } = req.body;
        if (!matric_no) {
            return res.status(400).json({ error: 'Matric number is required' });
        }

        const existing = await db.prepare('SELECT id FROM users WHERE matric_no = ?').get(matric_no);

        if (existing) {
            return res.status(409).json({ error: 'Account already exists. Please login.' });
        }

        const allowed = await db.prepare('SELECT id FROM allowed_matrics WHERE matric_no = ?').get(matric_no);

        if (!allowed) {
            return res.status(403).json({ error: 'This matric number is not authorized. Contact your admin.' });
        }

        const password = matric_no.slice(-4);
        const result = await db.prepare(
            'INSERT INTO users (matric_no, password, display_name) VALUES (?, ?, ?)'
        ).run(matric_no, password, matric_no);

        // Create streak record
        const newUserId = result.lastInsertRowid;
        await db.prepare('INSERT INTO streaks (user_id) VALUES (?)').run(newUserId);

        res.status(201).json({ message: 'Account created. Your default password is the last 4 characters of your matric number.' });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/auth/change-password
router.post('/change-password', verifyToken, async (req, res) => {
    try {
        const { current_password, new_password } = req.body;
        if (!new_password || new_password.length < 4) {
            return res.status(400).json({ error: 'New password must be at least 4 characters' });
        }

        const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

        if (!user.is_first_login && user.password !== current_password) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        await db.prepare('UPDATE users SET password = ?, is_first_login = 0 WHERE id = ?')
            .run(new_password, req.user.id);

        res.json({ message: 'Password changed successfully' });
    } catch (err) {
        console.error('Change password error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/auth/profile
router.get('/profile', verifyToken, async (req, res) => {
    try {
        const user = await db.prepare(
            'SELECT id, matric_no, display_name, bio, profile_pic_url, role, is_first_login, dob, birthday_pic_url, shoutout_url, instagram, twitter, created_at FROM users WHERE id = ?'
        ).get(req.user.id);

        if (!user) return res.status(404).json({ error: 'User not found' });

        const streak = await db.prepare('SELECT * FROM streaks WHERE user_id = ?').get(req.user.id);
        const achievements = await db.prepare('SELECT * FROM achievements WHERE user_id = ?').all(req.user.id);
        const quizCount = await db.prepare('SELECT COUNT(*) as count FROM attempts WHERE user_id = ?').get(req.user.id);
        const avgScore = await db.prepare(
            'SELECT AVG(CAST(score AS FLOAT) / total_questions * 100) as avg FROM attempts WHERE user_id = ?'
        ).get(req.user.id);

        res.json({
            ...user,
            is_first_login: user.is_first_login === 1,
            streak: streak || { current_streak: 0, longest_streak: 0 },
            achievements,
            stats: {
                quizzes_taken: quizCount ? Number(quizCount.count) : 0,
                avg_score: Math.round((avgScore && avgScore.avg) || 0),
            }
        });
    } catch (err) {
        console.error('Profile error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/auth/users (public directory)
router.get('/users', verifyToken, async (req, res) => {
    try {
        const users = await db.prepare(
            'SELECT id, matric_no, display_name, bio, profile_pic_url, role, created_at FROM users ORDER BY display_name ASC, matric_no ASC'
        ).all();
        res.json(users);
    } catch (err) {
        console.error('Get all users error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/auth/profile/:userId (public profile)
router.get('/profile/:userId', verifyToken, async (req, res) => {
    try {
        const user = await db.prepare(
            'SELECT id, matric_no, display_name, bio, profile_pic_url, role, created_at FROM users WHERE id = ?'
        ).get(req.params.userId);

        if (!user) return res.status(404).json({ error: 'User not found' });

        const streak = await db.prepare('SELECT current_streak, longest_streak FROM streaks WHERE user_id = ?').get(user.id);
        const achievements = await db.prepare('SELECT badge_type, earned_at FROM achievements WHERE user_id = ?').all(user.id);
        const quizCount = await db.prepare('SELECT COUNT(*) as count FROM attempts WHERE user_id = ?').get(user.id);
        const avgScore = await db.prepare(
            'SELECT AVG(CAST(score AS FLOAT) / total_questions * 100) as avg FROM attempts WHERE user_id = ?'
        ).get(user.id);
        const quizzesCreated = await db.prepare(
            'SELECT COUNT(*) as count FROM quizzes WHERE created_by = ? AND status = ?'
        ).get(user.id, 'approved');
        const recentAttempts = await db.prepare(`
      SELECT a.*, q.title as quiz_title, c.course_code
      FROM attempts a
      JOIN quizzes q ON a.quiz_id = q.id
      JOIN courses c ON q.course_id = c.id
      WHERE a.user_id = ?
      ORDER BY a.created_at DESC LIMIT 10
    `).all(user.id);

        res.json({
            ...user,
            streak: streak || { current_streak: 0, longest_streak: 0 },
            achievements,
            stats: {
                quizzes_taken: quizCount ? Number(quizCount.count) : 0,
                avg_score: Math.round((avgScore && avgScore.avg) || 0),
                quizzes_created: quizzesCreated ? Number(quizzesCreated.count) : 0,
            },
            recent_attempts: recentAttempts,
        });
    } catch (err) {
        console.error('Public profile error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/auth/profile
router.put('/profile', verifyToken, async (req, res) => {
    try {
        const { display_name, bio, dob, instagram, twitter } = req.body;
        await db.prepare('UPDATE users SET display_name = COALESCE(?, display_name), bio = COALESCE(?, bio), dob = COALESCE(?, dob), instagram = COALESCE(?, instagram), twitter = COALESCE(?, twitter) WHERE id = ?')
            .run(display_name, bio, dob || null, instagram ?? null, twitter ?? null, req.user.id);

        const user = await db.prepare(
            'SELECT id, matric_no, display_name, bio, profile_pic_url, role, is_first_login, dob, birthday_pic_url, shoutout_url, instagram, twitter FROM users WHERE id = ?'
        ).get(req.user.id);

        res.json({ ...user, is_first_login: user.is_first_login === 1 });
    } catch (err) {
        console.error('Update profile error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/auth/birthday-pic
router.post('/birthday-pic', verifyToken, uploadBirthdayPic.single('birthday_pic'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const url = req.file.path;
        await db.prepare('UPDATE users SET birthday_pic_url = ? WHERE id = ?').run(url, req.user.id);
        res.json({ birthday_pic_url: url });
    } catch (err) {
        console.error('Birthday pic upload error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/auth/birthday-pic
router.delete('/birthday-pic', verifyToken, async (req, res) => {
    try {
        await db.prepare("UPDATE users SET birthday_pic_url = '' WHERE id = ?").run(req.user.id);
        res.json({ message: 'Birthday picture removed' });
    } catch (err) {
        console.error('Birthday pic delete error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});



// POST /api/auth/avatar
router.post('/avatar', verifyToken, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const url = req.file.path; // Cloudinary returns the full URL in path
        await db.prepare('UPDATE users SET profile_pic_url = ? WHERE id = ?').run(url, req.user.id);
        res.json({ profile_pic_url: url });
    } catch (err) {
        console.error('Avatar upload error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/auth/pending-actions — pending role changes + unacknowledged demotions
router.get('/pending-actions', verifyToken, async (req, res) => {
    try {
        // Pending promotions
        const promotions = await db.prepare(`
          SELECT prc.*, u.display_name as requested_by_name
          FROM pending_role_changes prc
          LEFT JOIN users u ON prc.requested_by = u.id
          WHERE prc.user_id = ? AND prc.status = 'pending' AND prc.new_role = 'admin'
        `).all(req.user.id);

        // Unread demotion notifications
        const demotions = await db.prepare(`
          SELECT id, message, created_at FROM notifications
          WHERE user_id = ? AND type = 'role_demotion' AND is_read = 0
        `).all(req.user.id);

        res.json({ promotions, demotions });
    } catch (err) {
        console.error('Pending actions error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/auth/pending-actions/:id/respond — accept or decline role change
router.post('/pending-actions/:id/respond', verifyToken, async (req, res) => {
    try {
        const { action } = req.body; // 'accept' or 'decline'
        if (!['accept', 'decline'].includes(action)) {
            return res.status(400).json({ error: 'Action must be accept or decline' });
        }

        const pending = await db.prepare(
            "SELECT * FROM pending_role_changes WHERE id = ? AND user_id = ? AND status = 'pending'"
        ).get(req.params.id, req.user.id);

        if (!pending) return res.status(404).json({ error: 'No pending action found' });

        if (action === 'accept') {
            await db.prepare('UPDATE users SET role = ? WHERE id = ?').run(pending.new_role, req.user.id);
            await db.prepare("UPDATE pending_role_changes SET status = 'accepted' WHERE id = ?").run(pending.id);

            const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
            const newToken = jwt.sign(
                { id: user.id, matric_no: user.matric_no, role: user.role },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.json({ message: 'You are now an admin', new_role: 'admin', token: newToken });
        } else {
            await db.prepare("UPDATE pending_role_changes SET status = 'declined' WHERE id = ?").run(pending.id);
            res.json({ message: 'Admin invitation declined', new_role: 'student' });
        }
    } catch (err) {
        console.error('Pending action respond error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/auth/acknowledge-demotion — mark demotion notification as read
router.post('/acknowledge-demotion', verifyToken, async (req, res) => {
    try {
        await db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND type = 'role_demotion' AND is_read = 0").run(req.user.id);
        res.json({ message: 'Acknowledged' });
    } catch (err) {
        console.error('Acknowledge demotion error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Helper to parse device from User-Agent
function parseDevice(ua) {
    if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS Device';
    if (/Android/i.test(ua)) return 'Android Device';
    if (/Windows/i.test(ua)) return 'Windows PC';
    if (/Mac/i.test(ua)) return 'Mac';
    if (/Linux/i.test(ua)) return 'Linux PC';
    return 'Unknown Device';
}

// GET /api/auth/sessions — list active sessions for current user
router.get('/sessions', verifyToken, async (req, res) => {
    try {
        const sessions = await db.prepare(
            'SELECT id, device, ip_address, is_active, last_active, created_at FROM sessions WHERE user_id = ? AND is_active = 1 ORDER BY last_active DESC'
        ).all(req.user.id);

        // Mark the current session
        const authHeader = req.headers['authorization'];
        const currentToken = authHeader && authHeader.split(' ')[1];
        const currentHash = currentToken ? crypto.createHash('sha256').update(currentToken).digest('hex') : null;

        const currentSession = currentHash
            ? await db.prepare('SELECT id FROM sessions WHERE token_hash = ? AND is_active = 1').get(currentHash)
            : null;

        res.json(sessions.map(s => ({
            ...s,
            is_current: currentSession ? s.id === currentSession.id : false
        })));
    } catch (err) {
        console.error('Get sessions error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/auth/sessions/:id — revoke a session
router.delete('/sessions/:id', verifyToken, async (req, res) => {
    try {
        const result = await db.prepare(
            'UPDATE sessions SET is_active = 0 WHERE id = ? AND user_id = ?'
        ).run(req.params.id, req.user.id);

        if (result.changes === 0) return res.status(404).json({ error: 'Session not found' });
        res.json({ message: 'Session revoked' });
    } catch (err) {
        console.error('Revoke session error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/auth/logout — invalidate current session
router.post('/logout', verifyToken, async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const currentToken = authHeader && authHeader.split(' ')[1];
        if (currentToken) {
            const tokenHash = crypto.createHash('sha256').update(currentToken).digest('hex');
            await db.prepare('UPDATE sessions SET is_active = 0 WHERE token_hash = ?').run(tokenHash);
        }
        res.json({ message: 'Logged out' });
    } catch (err) {
        console.error('Logout error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
