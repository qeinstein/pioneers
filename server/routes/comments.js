import { Router } from 'express';
import db from '../db.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

function sanitize(str) {
    if (!str) return '';
    return str.replace(/[<>]/g, '').trim();
}

// GET /api/comments/:quizId
router.get('/:quizId', verifyToken, (req, res) => {
    try {
        const comments = db.prepare(`
      SELECT c.*, u.display_name, u.profile_pic_url, u.matric_no
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.quiz_id = ?
      ORDER BY c.created_at DESC
    `).all(req.params.quizId);

        res.json(comments);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/comments/:quizId
router.post('/:quizId', verifyToken, (req, res) => {
    try {
        const { text } = req.body;
        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'Comment text is required' });
        }

        const result = db.prepare(
            'INSERT INTO comments (quiz_id, user_id, text) VALUES (?, ?, ?)'
        ).run(req.params.quizId, req.user.id, sanitize(text));

        // Notify quiz creator
        const quiz = db.prepare('SELECT created_by, title FROM quizzes WHERE id = ?').get(req.params.quizId);
        if (quiz && quiz.created_by !== req.user.id) {
            const commenter = db.prepare('SELECT display_name FROM users WHERE id = ?').get(req.user.id);
            db.prepare(
                'INSERT INTO notifications (user_id, type, message, reference_id) VALUES (?, ?, ?, ?)'
            ).run(quiz.created_by, 'new_comment', `${commenter.display_name} commented on "${quiz.title}"`, parseInt(req.params.quizId));
        }

        const comment = db.prepare(`
      SELECT c.*, u.display_name, u.profile_pic_url, u.matric_no
      FROM comments c JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(result.lastInsertRowid);

        res.status(201).json(comment);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/comments/:id
router.delete('/:id', verifyToken, (req, res) => {
    try {
        const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id);
        if (!comment) return res.status(404).json({ error: 'Comment not found' });

        if (comment.user_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized' });
        }

        db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.id);
        res.json({ message: 'Comment deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
