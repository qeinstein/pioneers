import { Router } from 'express';
import db from '../db.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

// GET /api/leaderboard/global
router.get('/global', verifyToken, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT
        u.id as user_id,
        u.display_name,
        u.profile_pic_url,
        u.matric_no,
        MAX(CAST(a.score AS FLOAT) / a.total_questions * 100) as best_score,
        MIN(a.time_spent) as best_time,
        COUNT(a.id) as total_attempts,
        AVG(CAST(a.score AS FLOAT) / a.total_questions * 100) as avg_score
      FROM attempts a
      JOIN users u ON a.user_id = u.id
      GROUP BY u.id
      ORDER BY best_score DESC, best_time ASC, total_attempts ASC
      LIMIT 50
    `).all();

    const leaderboard = rows.map((r, i) => ({
      rank: i + 1,
      ...r,
      best_score: Math.round(r.best_score),
      avg_score: Math.round(r.avg_score),
    }));

    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/leaderboard/course/:courseId
router.get('/course/:courseId', verifyToken, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT
        u.id as user_id,
        u.display_name,
        u.profile_pic_url,
        u.matric_no,
        MAX(CAST(a.score AS FLOAT) / a.total_questions * 100) as best_score,
        MIN(a.time_spent) as best_time,
        COUNT(a.id) as total_attempts,
        AVG(CAST(a.score AS FLOAT) / a.total_questions * 100) as avg_score
      FROM attempts a
      JOIN users u ON a.user_id = u.id
      JOIN quizzes q ON a.quiz_id = q.id
      WHERE q.course_id = ?
      GROUP BY u.id
      ORDER BY best_score DESC, best_time ASC, total_attempts ASC
      LIMIT 50
    `).all(req.params.courseId);

    const leaderboard = rows.map((r, i) => ({
      rank: i + 1,
      ...r,
      best_score: Math.round(r.best_score),
      avg_score: Math.round(r.avg_score),
    }));

    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
