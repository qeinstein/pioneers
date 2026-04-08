import { Router } from 'express';
import db from '../db.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

// POST /api/live/create — create a live session from an existing quiz
router.post('/create', verifyToken, async (req, res) => {
    try {
        const { quiz_id, question_duration, question_count } = req.body;
        const quiz = await db.prepare('SELECT * FROM quizzes WHERE id = ? AND status = ?').get(quiz_id, 'approved');
        if (!quiz) return res.status(404).json({ error: 'Quiz not found or not approved' });

        const questions = await db.prepare('SELECT COUNT(*) as c FROM questions WHERE quiz_id = ?').get(quiz_id);
        const totalQuestions = Number(questions.c);
        if (totalQuestions === 0) return res.status(400).json({ error: 'Quiz has no questions' });

        // Validate question_count: clamp between 1 and total, guard against NaN/non-numeric
        const parsed = parseInt(question_count, 10);
        const resolvedCount = Number.isFinite(parsed) && parsed > 0
            ? Math.min(parsed, totalQuestions)
            : totalQuestions;

        let session_code;
        let attempts = 0;
        do {
            session_code = generateCode();
            attempts++;
            const existing = await db.prepare('SELECT id FROM live_sessions WHERE session_code = ? AND status != ?').get(session_code, 'finished');
            if (!existing) break;
        } while (attempts < 10);

        const result = await db.prepare(
            'INSERT INTO live_sessions (quiz_id, host_id, session_code, question_duration, question_count) VALUES (?, ?, ?, ?, ?)'
        ).run(quiz_id, req.user.id, session_code, question_duration || 20, resolvedCount);

        res.status(201).json({
            session_id: result.lastInsertRowid,
            session_code,
            quiz_title: quiz.title,
            question_count: resolvedCount,
        });
    } catch (err) {
        console.error('Create live session error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/live/:code — get session info
router.get('/:code', verifyToken, async (req, res) => {
    try {
        const session = await db.prepare(`
            SELECT ls.*, q.title as quiz_title, q.description as quiz_description,
                   u.display_name as host_name,
                   (SELECT COUNT(*) FROM questions WHERE quiz_id = ls.quiz_id) as question_count,
                   (SELECT COUNT(*) FROM live_participants WHERE session_id = ls.id) as participant_count
            FROM live_sessions ls
            JOIN quizzes q ON ls.quiz_id = q.id
            LEFT JOIN users u ON ls.host_id = u.id
            WHERE ls.session_code = ?
        `).get(req.params.code.toUpperCase());

        if (!session) return res.status(404).json({ error: 'Session not found' });

        res.json(session);
    } catch (err) {
        console.error('Get live session error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/live/:code/results — final results
router.get('/:code/results', verifyToken, async (req, res) => {
    try {
        const session = await db.prepare('SELECT * FROM live_sessions WHERE session_code = ?').get(req.params.code.toUpperCase());
        if (!session) return res.status(404).json({ error: 'Session not found' });

        const participants = await db.prepare(`
            SELECT lp.*, u.display_name, u.matric_no, u.profile_pic_url
            FROM live_participants lp
            JOIN users u ON lp.user_id = u.id
            WHERE lp.session_id = ?
            ORDER BY lp.total_score DESC
        `).all(session.id);

        res.json({ session, participants });
    } catch (err) {
        console.error('Get live results error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
