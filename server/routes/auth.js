import { Router } from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import db from '../db.js';
import { verifyToken, JWT_SECRET } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'pioneers_avatars',
        allowed_formats: ['jpeg', 'png', 'jpg', 'webp'],
        transformation: [{ width: 500, height: 500, crop: 'limit' }]
    }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

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
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                matric_no: user.matric_no,
                display_name: user.display_name,
                bio: user.bio,
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
            'SELECT id, matric_no, display_name, bio, profile_pic_url, role, is_first_login, created_at FROM users WHERE id = ?'
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
        const { display_name, bio } = req.body;
        await db.prepare('UPDATE users SET display_name = COALESCE(?, display_name), bio = COALESCE(?, bio) WHERE id = ?')
            .run(display_name, bio, req.user.id);

        const user = await db.prepare(
            'SELECT id, matric_no, display_name, bio, profile_pic_url, role, is_first_login FROM users WHERE id = ?'
        ).get(req.user.id);

        res.json({ ...user, is_first_login: user.is_first_login === 1 });
    } catch (err) {
        console.error('Update profile error:', err);
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
            res.json({ message: 'You are now an admin', new_role: 'admin' });
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

export default router;
