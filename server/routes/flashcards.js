import { Router } from 'express';
import db from '../db.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET /api/flashcards
router.get('/', verifyToken, async (req, res) => {
    try {
        const { course_id } = req.query;
        let query = `
            SELECT f.*, u.display_name, c.course_code 
            FROM flashcards f
            JOIN users u ON f.user_id = u.id
            LEFT JOIN courses c ON f.course_id = c.id
            WHERE 1=1
        `;
        const params = [];

        if (req.user.role === 'admin') {
            // Admin sees everything
        } else {
            // Normal user sees approved ones or their own
            query += " AND (f.status = 'approved' OR f.user_id = ?)";
            params.push(req.user.id);
        }

        if (course_id) {
            query += " AND f.course_id = ?";
            params.push(course_id);
        }

        query += " ORDER BY f.created_at DESC";

        const items = await db.prepare(query).all(...params);
        res.json(items.map(item => ({ ...item, cards: JSON.parse(item.cards_json) })));
    } catch (err) {
        console.error('Get flashcards error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/flashcards
router.post('/', verifyToken, async (req, res) => {
    try {
        const { title, description, course_id, cards } = req.body;
        if (!title || !cards || !Array.isArray(cards) || cards.length === 0) {
            return res.status(400).json({ error: 'Title and an array of cards are required' });
        }

        // Auto approve if admin
        const status = req.user.role === 'admin' ? 'approved' : 'pending';

        const result = await db.prepare(`
            INSERT INTO flashcards (course_id, user_id, title, description, cards_json, status)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(course_id || null, req.user.id, title, description || '', JSON.stringify(cards), status);

        const item = await db.prepare('SELECT * FROM flashcards WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json({ ...item, cards: JSON.parse(item.cards_json) });
    } catch (err) {
        console.error('Create flashcards error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/flashcards/:id/status
router.put('/:id/status', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        if (!['approved', 'rejected', 'pending'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const result = await db.prepare('UPDATE flashcards SET status = ? WHERE id = ?').run(status, req.params.id);
        if (result.changes === 0) return res.status(404).json({ error: 'Item not found' });

        res.json({ message: `Item ${status}` });
    } catch (err) {
        console.error('Update flashcards status error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/flashcards/:id
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        let result;
        if (req.user.role === 'admin') {
            result = await db.prepare('DELETE FROM flashcards WHERE id = ?').run(req.params.id);
        } else {
            result = await db.prepare('DELETE FROM flashcards WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
        }

        if (result.changes === 0) return res.status(404).json({ error: 'Item not found or unauthorized' });
        res.json({ message: 'Flashcard deck deleted' });
    } catch (err) {
        console.error('Delete flashcards error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
