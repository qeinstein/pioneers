import { Router } from 'express';
import db from '../db.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

// GET /api/leaderboard/global
router.get('/global', verifyToken, async (req, res) => {
  try {
    const rows = await db.prepare(`
      WITH UserQuizBest AS (
        SELECT user_id, quiz_id, MAX(score) as best_score_raw, MAX(CAST(score AS FLOAT) / (CASE WHEN total_questions = 0 THEN 1 ELSE total_questions END) * 100) as best_pct, MIN(time_spent) as best_time_raw, COUNT(id) as attempt_count
        FROM attempts
        GROUP BY user_id, quiz_id
      )
      SELECT
        u.id as user_id,
        u.display_name,
        u.profile_pic_url,
        u.matric_no,
        SUM(uqb.best_score_raw) as total_points,
        SUM(uqb.best_pct) / COUNT(uqb.quiz_id) as avg_score,
        SUM(uqb.best_time_raw) as best_time,
        SUM(uqb.attempt_count) as total_attempts
      FROM UserQuizBest uqb
      JOIN users u ON uqb.user_id = u.id
      GROUP BY u.id, u.display_name, u.profile_pic_url, u.matric_no
      ORDER BY total_points DESC, best_time ASC, total_attempts ASC
      LIMIT 50
    `).all();

    const leaderboard = rows.map((r, i) => ({
      rank: i + 1,
      ...r,
      total_points: Math.round(r.total_points),
      avg_score: Math.round(r.avg_score),
    }));

    res.json(leaderboard);
  } catch (err) {
    console.error('Global leaderboard error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/leaderboard/course/:courseId
router.get('/course/:courseId', verifyToken, async (req, res) => {
  try {
    const rows = await db.prepare(`
      WITH UserQuizBest AS (
        SELECT a.user_id, a.quiz_id, MAX(a.score) as best_score_raw, MAX(CAST(a.score AS FLOAT) / (CASE WHEN a.total_questions = 0 THEN 1 ELSE a.total_questions END) * 100) as best_pct, MIN(a.time_spent) as best_time_raw, COUNT(a.id) as attempt_count
        FROM attempts a
        JOIN quizzes q ON a.quiz_id = q.id
        WHERE q.course_id = ?
        GROUP BY a.user_id, a.quiz_id
      )
      SELECT
        u.id as user_id,
        u.display_name,
        u.profile_pic_url,
        u.matric_no,
        SUM(uqb.best_score_raw) as total_points,
        SUM(uqb.best_pct) / COUNT(uqb.quiz_id) as avg_score,
        SUM(uqb.best_time_raw) as best_time,
        SUM(uqb.attempt_count) as total_attempts
      FROM UserQuizBest uqb
      JOIN users u ON uqb.user_id = u.id
      GROUP BY u.id, u.display_name, u.profile_pic_url, u.matric_no
      ORDER BY total_points DESC, best_time ASC, total_attempts ASC
      LIMIT 50
    `).all(req.params.courseId);

    const leaderboard = rows.map((r, i) => ({
      rank: i + 1,
      ...r,
      total_points: Math.round(r.total_points),
      avg_score: Math.round(r.avg_score),
    }));

    res.json(leaderboard);
  } catch (err) {
    console.error('Course leaderboard error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
