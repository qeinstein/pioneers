import { Router } from 'express';
import db from '../db.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

// GET /api/bookmarks
router.get('/', verifyToken, (req, res) => {
    try {
        const bookmarks = db.prepare(`
      SELECT b.id as bookmark_id, b.created_at as bookmarked_at,
        q.*, c.course_code, c.course_name,
        (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count,
        (SELECT AVG(CAST(score AS FLOAT) / total_questions * 100) FROM attempts WHERE quiz_id = q.id) as avg_score
      FROM bookmarks b
      JOIN quizzes q ON b.quiz_id = q.id
      JOIN courses c ON q.course_id = c.id
      WHERE b.user_id = ? AND q.status = 'approved'
      ORDER BY b.created_at DESC
    `).all(req.user.id);

        res.json(bookmarks.map(b => ({ ...b, tags: JSON.parse(b.tags || '[]') })));
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/bookmarks/:quizId
router.post('/:quizId', verifyToken, (req, res) => {
    try {
        db.prepare('INSERT OR IGNORE INTO bookmarks (user_id, quiz_id) VALUES (?, ?)').run(req.user.id, req.params.quizId);
        res.status(201).json({ message: 'Bookmarked' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/bookmarks/:quizId
router.delete('/:quizId', verifyToken, (req, res) => {
    try {
        db.prepare('DELETE FROM bookmarks WHERE user_id = ? AND quiz_id = ?').run(req.user.id, req.params.quizId);
        res.json({ message: 'Bookmark removed' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
