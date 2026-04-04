import { Router } from 'express';
import db from '../db.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';
import { getPagination, setPaginationHeaders } from '../utils/pagination.js';

const router = Router();

async function createSystemNotification({ type, message, referenceId = null, expiresInDays = null }) {
    const expiresAt = expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

    await db.prepare(`
        INSERT INTO system_notifications (type, message, reference_id, expires_at)
        VALUES (?, ?, ?, ?)
    `).run(type, message, referenceId, expiresAt);
}

router.get('/', verifyToken, async (req, res) => {
    try {
        const { page, limit, offset } = getPagination(req.query, { defaultLimit: 20, maxLimit: 50 });
        const countRow = await db.prepare('SELECT COUNT(*) as count FROM polls').get();

        const rows = await db.query(`
            WITH paged_polls AS (
                SELECT p.*, u.display_name as creator_name
                FROM polls p
                JOIN users u ON p.created_by = u.id
                ORDER BY p.is_active DESC, p.created_at DESC
                LIMIT $2 OFFSET $3
            ),
            user_vote AS (
                SELECT poll_id, option_id
                FROM poll_votes
                WHERE user_id = $1
            )
            SELECT
                p.id,
                p.title,
                p.description,
                p.created_by,
                p.is_public,
                p.is_active,
                p.created_at,
                p.creator_name,
                po.id as option_id,
                po.option_text,
                COUNT(pv.id) as vote_count,
                uv.option_id as user_voted_option,
                (
                    SELECT COUNT(*)
                    FROM poll_votes pv_total
                    WHERE pv_total.poll_id = p.id
                ) as total_votes
            FROM paged_polls p
            LEFT JOIN poll_options po ON po.poll_id = p.id
            LEFT JOIN poll_votes pv ON pv.option_id = po.id
            LEFT JOIN user_vote uv ON uv.poll_id = p.id
            GROUP BY
                p.id, p.title, p.description, p.created_by, p.is_public, p.is_active, p.created_at,
                p.creator_name, po.id, po.option_text, uv.option_id
            ORDER BY p.is_active DESC, p.created_at DESC, po.id ASC
        `, [req.user.id, limit, offset]);

        const pollsById = new Map();
        for (const row of rows.rows) {
            let poll = pollsById.get(row.id);
            if (!poll) {
                const canSeeResults = req.user.role === 'admin' || Number(row.is_public) === 1;
                poll = {
                    id: row.id,
                    title: row.title,
                    description: row.description,
                    created_by: row.created_by,
                    is_public: row.is_public,
                    is_active: row.is_active,
                    created_at: row.created_at,
                    creator_name: row.creator_name,
                    options: [],
                    user_voted_option: row.user_voted_option || null,
                    can_see_results: canSeeResults,
                    total_votes: Number(row.total_votes),
                };
                pollsById.set(row.id, poll);
            }

            if (row.option_id) {
                poll.options.push({
                    id: row.option_id,
                    option_text: row.option_text,
                    vote_count: poll.can_see_results ? Number(row.vote_count) : undefined,
                });
            }
        }

        setPaginationHeaders(res, {
            page,
            limit,
            total: countRow ? Number(countRow.count) : 0,
        });

        res.json([...pollsById.values()]);
    } catch (err) {
        console.error('Get polls error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

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

        await createSystemNotification({
            type: 'poll',
            message: `New Poll Available: "${title}"`,
            referenceId: pollId,
            expiresInDays: 30,
        });

        res.status(201).json({ message: 'Poll created', id: pollId });
    } catch (err) {
        console.error('Create poll error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/:id/vote', verifyToken, async (req, res) => {
    try {
        const { option_id } = req.body;
        if (!option_id) {
            return res.status(400).json({ error: 'Option ID is required' });
        }

        const poll = await db.prepare('SELECT * FROM polls WHERE id = $1').get(req.params.id);
        if (!poll) return res.status(404).json({ error: 'Poll not found' });
        if (!poll.is_active) return res.status(400).json({ error: 'This poll is closed' });

        const option = await db.prepare(
            'SELECT * FROM poll_options WHERE id = $1 AND poll_id = $2'
        ).get(option_id, req.params.id);
        if (!option) return res.status(400).json({ error: 'Invalid option for this poll' });

        const existing = await db.prepare(
            'SELECT id FROM poll_votes WHERE poll_id = $1 AND user_id = $2'
        ).get(req.params.id, req.user.id);

        if (existing) {
            return res.status(400).json({ error: 'You have already voted on this poll' });
        }

        await db.prepare(
            'INSERT INTO poll_votes (poll_id, option_id, user_id) VALUES ($1, $2, $3)'
        ).run(req.params.id, option_id, req.user.id);

        res.json({ message: 'Vote recorded' });
    } catch (err) {
        console.error('Vote error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

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
