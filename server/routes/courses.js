import { Router } from 'express';
import db from '../db.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET /api/courses
router.get('/', verifyToken, async (req, res) => {
    try {
        const courses = await db.prepare(`
      SELECT c.*, u.display_name as creator_name,
        (SELECT COUNT(*) FROM quizzes WHERE course_id = c.id AND status = 'approved') as quiz_count
      FROM courses c
      LEFT JOIN users u ON c.created_by = u.id
      ORDER BY c.course_code ASC
    `).all();
        res.json(courses);
    } catch (err) {
        console.error('Get courses error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/courses/:id
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const course = await db.prepare(`
      SELECT c.*, u.display_name as creator_name
      FROM courses c
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.id = ?
    `).get(req.params.id);

        if (!course) return res.status(404).json({ error: 'Course not found' });

        const quizzes = await db.prepare(`
      SELECT q.*, u.display_name as creator_name,
        (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count,
        (SELECT AVG(CAST(score AS FLOAT) / total_questions * 100) FROM attempts WHERE quiz_id = q.id) as avg_score
      FROM quizzes q
      LEFT JOIN users u ON q.created_by = u.id
      WHERE q.course_id = ? AND q.status = 'approved'
      ORDER BY q.created_at DESC
    `).all(req.params.id);

        res.json({ ...course, quizzes });
    } catch (err) {
        console.error('Get course detail error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/courses (admin only)
router.post('/', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { course_code, course_name, description } = req.body;
        if (!course_code || !course_name) {
            return res.status(400).json({ error: 'Course code and name are required' });
        }

        const result = await db.prepare(
            'INSERT INTO courses (course_code, course_name, description, created_by) VALUES (?, ?, ?, ?)'
        ).run(course_code, course_name, description || '', req.user.id);

        const course = await db.prepare('SELECT * FROM courses WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(course);
    } catch (err) {
        console.error('Create course error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/courses/:id (admin only)
router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { course_code, course_name, description } = req.body;
        await db.prepare(
            'UPDATE courses SET course_code = COALESCE(?, course_code), course_name = COALESCE(?, course_name), description = COALESCE(?, description) WHERE id = ?'
        ).run(course_code, course_name, description, req.params.id);

        const course = await db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
        res.json(course);
    } catch (err) {
        console.error('Update course error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/courses/:id (admin only)
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        await db.prepare('DELETE FROM courses WHERE id = ?').run(req.params.id);
        res.json({ message: 'Course deleted' });
    } catch (err) {
        console.error('Delete course error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
