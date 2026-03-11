import { Router } from 'express';
import db from '../db.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

// GET /api/notifications
router.get('/', verifyToken, async (req, res) => {
    try {
        const notifications = await db.prepare(
            'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
        ).all(req.user.id);

        const unreadCount = await db.prepare(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0'
        ).get(req.user.id);

        res.json({ notifications, unread_count: unreadCount ? Number(unreadCount.count) : 0 });
    } catch (err) {
        console.error('Get notifications error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', verifyToken, async (req, res) => {
    try {
        await db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
        res.json({ message: 'Marked as read' });
    } catch (err) {
        console.error('Mark notification read error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/notifications/read-all
router.put('/read-all', verifyToken, async (req, res) => {
    try {
        await db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
        res.json({ message: 'All marked as read' });
    } catch (err) {
        console.error('Mark all read error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
