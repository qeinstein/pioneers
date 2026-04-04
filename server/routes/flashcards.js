import { Router } from 'express';
import db from '../db.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';
import { getPagination, setPaginationHeaders } from '../utils/pagination.js';

const router = Router();

router.get('/', verifyToken, async (req, res) => {
    try {
        const { course_id, search = '' } = req.query;
        const { page, limit, offset } = getPagination(req.query, { defaultLimit: 24, maxLimit: 100 });
        const filters = [];
        const params = [];

        if (req.user.role === 'admin') {
            if (req.query.status) {
                filters.push('f.status = ?');
                params.push(req.query.status);
            }
        } else {
            filters.push("(f.status = 'approved' OR f.user_id = ?)");
            params.push(req.user.id);
        }

        if (course_id) {
            filters.push('f.course_id = ?');
            params.push(course_id);
        }

        if (search.trim()) {
            filters.push('(f.title ILIKE ? OR f.description ILIKE ?)');
            params.push(`%${search.trim()}%`, `%${search.trim()}%`);
        }

        const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
        const countRow = await db.prepare(`
            SELECT COUNT(*) as count
            FROM flashcards f
            ${whereClause}
        `).get(...params);

        const items = await db.prepare(`
            SELECT
                f.id,
                f.course_id,
                f.user_id,
                f.title,
                f.description,
                f.status,
                f.created_at,
                u.display_name,
                c.course_code,
                COALESCE(jsonb_array_length(f.cards_json::jsonb), 0) as card_count
            FROM flashcards f
            JOIN users u ON f.user_id = u.id
            LEFT JOIN courses c ON f.course_id = c.id
            ${whereClause}
            ORDER BY f.created_at DESC
            LIMIT ? OFFSET ?
        `).all(...params, limit, offset);

        setPaginationHeaders(res, {
            page,
            limit,
            total: countRow ? Number(countRow.count) : 0,
        });

        res.json(items.map(item => ({ ...item, card_count: Number(item.card_count) })));
    } catch (err) {
        console.error('Get flashcards error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/:id', verifyToken, async (req, res) => {
    try {
        const item = await db.prepare(`
            SELECT f.*, u.display_name, c.course_code
            FROM flashcards f
            JOIN users u ON f.user_id = u.id
            LEFT JOIN courses c ON f.course_id = c.id
            WHERE f.id = ?
        `).get(req.params.id);

        if (!item) return res.status(404).json({ error: 'Deck not found' });
        if (req.user.role !== 'admin' && item.status !== 'approved' && item.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        res.json({ ...item, cards: JSON.parse(item.cards_json) });
    } catch (err) {
        console.error('Get flashcard detail error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/', verifyToken, async (req, res) => {
    try {
        const { title, description, course_id, cards } = req.body;
        if (!title || !cards || !Array.isArray(cards) || cards.length === 0) {
            return res.status(400).json({ error: 'Title and an array of cards are required' });
        }

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
