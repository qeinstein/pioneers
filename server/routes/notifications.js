import { Router } from 'express';
import db from '../db.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

// GET /api/notifications
router.get('/', verifyToken, (req, res) => {
    try {
        const notifications = db.prepare(
            'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
        ).all(req.user.id);

        const unreadCount = db.prepare(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0'
        ).get(req.user.id);

        res.json({ notifications, unread_count: unreadCount.count });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', verifyToken, (req, res) => {
    try {
        db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
        res.json({ message: 'Marked as read' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/notifications/read-all
router.put('/read-all', verifyToken, (req, res) => {
    try {
        db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
        res.json({ message: 'All marked as read' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
