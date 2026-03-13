import { Router } from 'express';
import db from '../db.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET /api/polls — list all polls (active first, then closed)
router.get('/', verifyToken, async (req, res) => {
    try {
        const polls = await db.prepare(`
            SELECT p.*, u.display_name as creator_name,
                   (SELECT COUNT(*) FROM poll_votes pv WHERE pv.poll_id = p.id) as total_votes
            FROM polls p
            JOIN users u ON p.created_by = u.id
            ORDER BY p.is_active DESC, p.created_at DESC
        `).all();

        // For each poll, get options and vote counts
        const result = [];
        for (const poll of polls) {
            const options = await db.prepare(`
                SELECT po.*, 
                       (SELECT COUNT(*) FROM poll_votes pv WHERE pv.option_id = po.id) as vote_count
                FROM poll_options po
                WHERE po.poll_id = $1
                ORDER BY po.id ASC
            `).all(poll.id);

            // Check if current user has voted
            const userVote = await db.prepare(
                'SELECT option_id FROM poll_votes WHERE poll_id = $1 AND user_id = $2'
            ).get(poll.id, req.user.id);

            // Only include vote counts if admin or results are public
            const canSeeResults = req.user.role === 'admin' || poll.is_public === 1;

            result.push({
                ...poll,
                options: options.map(o => ({
                    ...o,
                    vote_count: canSeeResults ? Number(o.vote_count) : undefined
                })),
                user_voted_option: userVote ? userVote.option_id : null,
                can_see_results: canSeeResults,
                total_votes: Number(poll.total_votes)
            });
        }

        res.json(result);
    } catch (err) {
        console.error('Get polls error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/polls — create a new poll (admin only)
router.post('/', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { title, description, options } = req.body;
        if (!title || !options || !Array.isArray(options) || options.length < 2) {
            return res.status(400).json({ error: 'Title and at least 2 options are required' });
        }

        const result = await db.prepare(
            'INSERT INTO polls (title, description, created_by) VALUES ($1, $2, $3)'
        ).run(title, description || '', req.user.id);

        const pollId = result.lastInsertRowid;

        for (const optionText of options) {
            if (optionText.trim()) {
                await db.prepare(
                    'INSERT INTO poll_options (poll_id, option_text) VALUES ($1, $2)'
                ).run(pollId, optionText.trim());
            }
        }

        // Notify all standard users about the new poll
        const users = await db.prepare("SELECT id FROM users WHERE role = 'student'").all();
        const notifyStmt = db.prepare('INSERT INTO notifications (user_id, type, message) VALUES ($1, $2, $3)');
        for (const user of users) {
            notifyStmt.run(user.id, 'poll', `New Poll Available: "${title}"`);
        }

        res.status(201).json({ message: 'Poll created', id: pollId });
    } catch (err) {
        console.error('Create poll error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/polls/:id/vote — cast a vote
router.post('/:id/vote', verifyToken, async (req, res) => {
    try {
        const { option_id } = req.body;
        if (!option_id) {
            return res.status(400).json({ error: 'Option ID is required' });
        }

        // Check poll exists and is active
        const poll = await db.prepare('SELECT * FROM polls WHERE id = $1').get(req.params.id);
        if (!poll) return res.status(404).json({ error: 'Poll not found' });
        if (!poll.is_active) return res.status(400).json({ error: 'This poll is closed' });

        // Check option belongs to this poll
        const option = await db.prepare(
            'SELECT * FROM poll_options WHERE id = $1 AND poll_id = $2'
        ).get(option_id, req.params.id);
        if (!option) return res.status(400).json({ error: 'Invalid option for this poll' });

        const existing = await db.prepare(
            'SELECT id FROM poll_votes WHERE poll_id = $1 AND user_id = $2'
        ).get(req.params.id, req.user.id);

        if (existing) {
            return res.status(400).json({ error: 'You have already voted on this poll' });
        } else {
            // Insert new vote
            await db.prepare(
                'INSERT INTO poll_votes (poll_id, option_id, user_id) VALUES ($1, $2, $3)'
            ).run(req.params.id, option_id, req.user.id);
            res.json({ message: 'Vote recorded' });
        }
    } catch (err) {
        console.error('Vote error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/polls/:id — update poll settings (admin only)
router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { is_public, is_active } = req.body;

        const poll = await db.prepare('SELECT * FROM polls WHERE id = $1').get(req.params.id);
        if (!poll) return res.status(404).json({ error: 'Poll not found' });

        const newPublic = is_public !== undefined ? (is_public ? 1 : 0) : poll.is_public;
        const newActive = is_active !== undefined ? (is_active ? 1 : 0) : poll.is_active;

        await db.prepare(
            'UPDATE polls SET is_public = $1, is_active = $2 WHERE id = $3'
        ).run(newPublic, newActive, req.params.id);

        res.json({ message: 'Poll updated' });
    } catch (err) {
        console.error('Update poll error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/polls/:id — delete a poll (admin only)
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const result = await db.prepare('DELETE FROM polls WHERE id = $1').run(req.params.id);
        if (result.changes === 0) return res.status(404).json({ error: 'Poll not found' });
        res.json({ message: 'Poll deleted' });
    } catch (err) {
        console.error('Delete poll error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
