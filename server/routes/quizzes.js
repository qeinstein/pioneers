import { Router } from 'express';
import db from '../db.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

function sanitize(str) {
    if (!str) return '';
    return str.replace(/[<>]/g, '').trim();
}

async function updateStreak(userId) {
    const today = new Date().toISOString().split('T')[0];
    let streak = await db.prepare('SELECT * FROM streaks WHERE user_id = ?').get(userId);

    if (!streak) {
        await db.prepare('INSERT INTO streaks (user_id, current_streak, longest_streak, last_activity_date) VALUES (?, 1, 1, ?)').run(userId, today);
        return;
    }

    if (streak.last_activity_date === today) return;

    const lastDate = new Date(streak.last_activity_date);
    const todayDate = new Date(today);
    const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

    let newStreak = diffDays === 1 ? streak.current_streak + 1 : 1;
    let longest = Math.max(newStreak, streak.longest_streak);

    await db.prepare('UPDATE streaks SET current_streak = ?, longest_streak = ?, last_activity_date = ? WHERE user_id = ?')
        .run(newStreak, longest, today, userId);

    // Streak achievements
    if (newStreak >= 3) {
        await db.prepare('INSERT OR IGNORE INTO achievements (user_id, badge_type) VALUES (?, ?)').run(userId, 'streak_3');
    }
    if (newStreak >= 7) {
        await db.prepare('INSERT OR IGNORE INTO achievements (user_id, badge_type) VALUES (?, ?)').run(userId, 'streak_7');
    }
}

async function checkAchievements(userId) {
    const attemptCountRow = await db.prepare('SELECT COUNT(*) as c FROM attempts WHERE user_id = ?').get(userId);
    const attemptCount = attemptCountRow ? Number(attemptCountRow.c) : 0;

    if (attemptCount >= 1) {
        await db.prepare('INSERT OR IGNORE INTO achievements (user_id, badge_type) VALUES (?, ?)').run(userId, 'first_quiz');
    }
    if (attemptCount >= 10) {
        await db.prepare('INSERT OR IGNORE INTO achievements (user_id, badge_type) VALUES (?, ?)').run(userId, 'ten_quizzes');
    }
    if (attemptCount >= 50) {
        await db.prepare('INSERT OR IGNORE INTO achievements (user_id, badge_type) VALUES (?, ?)').run(userId, 'fifty_quizzes');
    }

    const perfectScore = await db.prepare(
        'SELECT id FROM attempts WHERE user_id = ? AND score = total_questions LIMIT 1'
    ).get(userId);
    if (perfectScore) {
        await db.prepare('INSERT OR IGNORE INTO achievements (user_id, badge_type) VALUES (?, ?)').run(userId, 'perfect_score');
    }

    const quizzesCreatedRow = await db.prepare(
        'SELECT COUNT(*) as c FROM quizzes WHERE created_by = ? AND status = ?'
    ).get(userId, 'approved');
    const quizzesCreated = quizzesCreatedRow ? Number(quizzesCreatedRow.c) : 0;
    if (quizzesCreated >= 1) {
        await db.prepare('INSERT OR IGNORE INTO achievements (user_id, badge_type) VALUES (?, ?)').run(userId, 'quiz_creator');
    }
}

// GET /api/quizzes — quiz bank
router.get('/', verifyToken, async (req, res) => {
    try {
        const { search, course_id, tag, status } = req.query;
        let query = `
      SELECT q.*, c.course_code, c.course_name, u.display_name as creator_name,
        (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count,
        (SELECT AVG(CAST(score AS FLOAT) / total_questions * 100) FROM attempts WHERE quiz_id = q.id) as avg_score
      FROM quizzes q
      JOIN courses c ON q.course_id = c.id
      LEFT JOIN users u ON q.created_by = u.id
      WHERE 1=1
    `;
        const params = [];

        if (status) {
            query += ' AND q.status = ?';
            params.push(status);
        } else {
            query += ' AND q.status = ?';
            params.push('approved');
        }

        if (search) {
            query += ' AND (q.title ILIKE ? OR q.description ILIKE ? OR c.course_code ILIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (course_id) {
            query += ' AND q.course_id = ?';
            params.push(course_id);
        }
        if (tag) {
            query += ' AND q.tags ILIKE ?';
            params.push(`%${tag}%`);
        }

        query += ' ORDER BY q.created_at DESC';

        const quizzes = await db.prepare(query).all(...params);

        // Calculate difficulty for each quiz
        const result = quizzes.map(q => {
            let difficulty = 'Medium';
            if (q.avg_score !== null) {
                if (q.avg_score >= 80) difficulty = 'Easy';
                else if (q.avg_score < 50) difficulty = 'Hard';
            }
            return { ...q, difficulty, tags: JSON.parse(q.tags || '[]') };
        });

        res.json(result);
    } catch (err) {
        console.error('Get quizzes error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/quizzes/tags/recent — get top 10 tags based on recent activity
router.get('/tags/recent', verifyToken, async (req, res) => {
    try {
        // Fetch recently attempted quizzes
        const attempts = await db.prepare(`
            SELECT q.tags 
            FROM attempts a 
            JOIN quizzes q ON a.quiz_id = q.id 
            WHERE q.status = 'approved'
            ORDER BY a.created_at DESC 
            LIMIT 100
        `).all();

        const tagCounts = {};
        for (const row of attempts) {
            try {
                const tags = JSON.parse(row.tags || '[]');
                for (const t of tags) {
                    tagCounts[t] = (tagCounts[t] || 0) + 1;
                }
            } catch (e) { }
        }

        // If not enough from attempts, fetch from recently created quizzes
        if (Object.keys(tagCounts).length < 5) {
            const recentQuizzes = await db.prepare(`
                SELECT tags FROM quizzes WHERE status = 'approved' ORDER BY created_at DESC LIMIT 50
            `).all();
            for (const row of recentQuizzes) {
                try {
                    const tags = JSON.parse(row.tags || '[]');
                    for (const t of tags) {
                        tagCounts[t] = (tagCounts[t] || 0) + 1;
                    }
                } catch (e) { }
            }
        }

        // Sort by frequency and take top 10
        const topTags = Object.entries(tagCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(entry => entry[0]);

        res.json(topTags);
    } catch (err) {
        console.error('Get recent tags error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/quizzes/my — quizzes created by current user
router.get('/my', verifyToken, async (req, res) => {
    try {
        const quizzes = await db.prepare(`
      SELECT q.*, c.course_code, c.course_name,
        (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count,
        (SELECT AVG(CAST(score AS FLOAT) / total_questions * 100) FROM attempts WHERE quiz_id = q.id) as avg_score
      FROM quizzes q
      JOIN courses c ON q.course_id = c.id
      WHERE q.created_by = ?
      ORDER BY q.created_at DESC
    `).all(req.user.id);

        res.json(quizzes.map(q => ({ ...q, tags: JSON.parse(q.tags || '[]') })));
    } catch (err) {
        console.error('Get my quizzes error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/quizzes/:id — quiz detail with questions
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const quiz = await db.prepare(`
      SELECT q.*, c.course_code, c.course_name, u.display_name as creator_name,
        (SELECT AVG(CAST(score AS FLOAT) / total_questions * 100) FROM attempts WHERE quiz_id = q.id) as avg_score
      FROM quizzes q
      JOIN courses c ON q.course_id = c.id
      LEFT JOIN users u ON q.created_by = u.id
      WHERE q.id = ?
    `).get(req.params.id);

        if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

        const questions = await db.prepare('SELECT * FROM questions WHERE quiz_id = ?').all(quiz.id);

        let difficulty = 'Medium';
        if (quiz.avg_score !== null) {
            if (quiz.avg_score >= 80) difficulty = 'Easy';
            else if (quiz.avg_score < 50) difficulty = 'Hard';
        }

        // Check if bookmarked
        const bookmark = await db.prepare('SELECT id FROM bookmarks WHERE user_id = ? AND quiz_id = ?')
            .get(req.user.id, quiz.id);

        // User's past attempts
        const attempts = await db.prepare(
            'SELECT score, total_questions, time_spent, created_at FROM attempts WHERE user_id = ? AND quiz_id = ? ORDER BY created_at DESC'
        ).all(req.user.id, quiz.id);

        res.json({
            ...quiz,
            tags: JSON.parse(quiz.tags || '[]'),
            difficulty,
            questions,
            is_bookmarked: !!bookmark,
            my_attempts: attempts,
        });
    } catch (err) {
        console.error('Get quiz detail error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/quizzes — create quiz (everyone)
router.post('/', verifyToken, async (req, res) => {
    try {
        const { course_id, title, description, tags, questions } = req.body;
        if (!course_id || !title || !questions || !questions.length) {
            return res.status(400).json({ error: 'Course, title, and at least one question are required' });
        }

        const status = req.user.role === 'admin' ? 'approved' : 'pending';

        const result = await db.prepare(
            'INSERT INTO quizzes (course_id, created_by, title, description, tags, status) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(course_id, req.user.id, sanitize(title), sanitize(description || ''), JSON.stringify(tags || []), status);

        const quizId = result.lastInsertRowid;

        for (const q of questions) {
            await db.prepare(
                'INSERT INTO questions (quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            ).run(
                quizId,
                sanitize(q.question_text),
                sanitize(q.option_a),
                sanitize(q.option_b),
                sanitize(q.option_c),
                sanitize(q.option_d),
                q.correct_option,
                sanitize(q.explanation || '')
            );
        }

        if (status === 'pending') {
            // Notify admins
            const admins = await db.prepare('SELECT id FROM users WHERE role = ?').all('admin');
            for (const admin of admins) {
                await db.prepare(
                    'INSERT INTO notifications (user_id, type, message, reference_id) VALUES (?, ?, ?, ?)'
                ).run(admin.id, 'quiz_pending', `New quiz "${title}" is pending approval`, quizId);
            }
        }

        res.status(201).json({ id: quizId, status });
    } catch (err) {
        console.error('Create quiz error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/quizzes/:id — update quiz
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const quiz = await db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.id);
        if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

        if (quiz.created_by !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const { title, description, tags, course_id, questions } = req.body;

        await db.prepare(
            'UPDATE quizzes SET title = COALESCE(?, title), description = COALESCE(?, description), tags = COALESCE(?, tags), course_id = COALESCE(?, course_id) WHERE id = ?'
        ).run(
            title ? sanitize(title) : null,
            description !== undefined ? sanitize(description) : null,
            tags ? JSON.stringify(tags) : null,
            course_id || null,
            req.params.id
        );

        if (questions && questions.length) {
            await db.prepare('DELETE FROM questions WHERE quiz_id = ?').run(req.params.id);
            for (const q of questions) {
                await db.prepare(
                    'INSERT INTO questions (quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
                ).run(
                    req.params.id,
                    sanitize(q.question_text),
                    sanitize(q.option_a),
                    sanitize(q.option_b),
                    sanitize(q.option_c),
                    sanitize(q.option_d),
                    q.correct_option,
                    sanitize(q.explanation || '')
                );
            }
        }

        res.json({ message: 'Quiz updated' });
    } catch (err) {
        console.error('Update quiz error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/quizzes/:id
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const quiz = await db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.id);
        if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

        if (quiz.created_by !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized' });
        }

        await db.prepare('DELETE FROM quizzes WHERE id = ?').run(req.params.id);
        res.json({ message: 'Quiz deleted' });
    } catch (err) {
        console.error('Delete quiz error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/quizzes/:id/attempt — submit quiz answers
router.post('/:id/attempt', verifyToken, async (req, res) => {
    try {
        const { answers, time_spent } = req.body;
        const quiz = await db.prepare('SELECT * FROM quizzes WHERE id = ? AND status = ?').get(req.params.id, 'approved');
        if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

        const questions = await db.prepare('SELECT * FROM questions WHERE quiz_id = ?').all(quiz.id);

        let score = 0;
        const results = questions.map(q => {
            const userAnswer = answers[q.id] || '';
            const isCorrect = userAnswer.toLowerCase() === q.correct_option.toLowerCase();
            if (isCorrect) score++;
            return {
                question_id: q.id,
                question_text: q.question_text,
                option_a: q.option_a,
                option_b: q.option_b,
                option_c: q.option_c,
                option_d: q.option_d,
                correct_option: q.correct_option,
                user_answer: userAnswer,
                is_correct: isCorrect,
                explanation: q.explanation,
            };
        });

        await db.prepare(
            'INSERT INTO attempts (user_id, quiz_id, score, total_questions, time_spent) VALUES (?, ?, ?, ?, ?)'
        ).run(req.user.id, quiz.id, score, questions.length, time_spent || 0);

        await db.prepare('UPDATE quizzes SET times_taken = times_taken + 1 WHERE id = ?').run(quiz.id);

        // Update streak & check achievements
        await updateStreak(req.user.id);
        await checkAchievements(req.user.id);

        res.json({
            score,
            total: questions.length,
            percentage: Math.round((score / questions.length) * 100),
            time_spent: time_spent || 0,
            results,
        });
    } catch (err) {
        console.error('Submit attempt error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
