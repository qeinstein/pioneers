import { Router } from 'express';
import db from '../db.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

function sanitize(str) {
    if (!str) return '';
    return str.replace(/[<>]/g, '').trim();
}

// GET /api/suggestions
router.get('/', verifyToken, async (req, res) => {
    try {
        let suggestions;
        if (req.user.role === 'admin') {
            suggestions = await db.prepare(`
        SELECT s.*, u.display_name, u.matric_no
        FROM suggestions s
        JOIN users u ON s.user_id = u.id
        ORDER BY s.created_at DESC
      `).all();
        } else {
            suggestions = await db.prepare(`
        SELECT s.*, u.display_name, u.matric_no
        FROM suggestions s
        JOIN users u ON s.user_id = u.id
        WHERE s.user_id = ?
        ORDER BY s.created_at DESC
      `).all(req.user.id);
        }
        res.json(suggestions);
    } catch (err) {
        console.error('Get suggestions error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/suggestions
router.post('/', verifyToken, async (req, res) => {
    try {
        const { title, text } = req.body;
        if (!title || !text) {
            return res.status(400).json({ error: 'Title and text are required' });
        }

        const result = await db.prepare(
            'INSERT INTO suggestions (user_id, title, text) VALUES (?, ?, ?)'
        ).run(req.user.id, sanitize(title), sanitize(text));

        const suggestion = await db.prepare('SELECT * FROM suggestions WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(suggestion);
    } catch (err) {
        console.error('Create suggestion error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/suggestions/:id/review (admin)
router.put('/:id/review', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        await db.prepare('UPDATE suggestions SET status = ? WHERE id = ?').run('reviewed', req.params.id);
        res.json({ message: 'Suggestion marked as reviewed' });
    } catch (err) {
        console.error('Review suggestion error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
