import { Router } from 'express';
import db from '../db.js';
import { verifyToken } from '../middleware/auth.js';
import { parsePositiveInt } from '../utils/pagination.js';

const router = Router();

function normalizeNotificationRow(row) {
    return {
        ...row,
        is_read: Number(row.is_read),
    };
}

function parseNotificationId(rawId) {
    if (typeof rawId !== 'string') {
        return { scope: 'user', id: rawId };
    }

    if (rawId.startsWith('system:')) {
        return { scope: 'system', id: rawId.slice(7) };
    }

    if (rawId.startsWith('user:')) {
        return { scope: 'user', id: rawId.slice(5) };
    }

    return { scope: 'user', id: rawId };
}

router.get('/', verifyToken, async (req, res) => {
    try {
        const limit = Math.min(parsePositiveInt(req.query.limit, 50), 100);

        const notificationsResult = await db.query(`
            SELECT *
            FROM (
                SELECT
                    CONCAT('user:', n.id) AS id,
                    n.type,
                    n.message,
                    n.reference_id,
                    n.is_read,
                    n.created_at
                FROM notifications n
                WHERE n.user_id = $1

                UNION ALL

                SELECT
                    CONCAT('system:', sn.id) AS id,
                    sn.type,
                    sn.message,
                    sn.reference_id,
                    CASE WHEN snr.user_id IS NULL THEN 0 ELSE 1 END AS is_read,
                    sn.created_at
                FROM system_notifications sn
                LEFT JOIN system_notification_reads snr
                    ON snr.notification_id = sn.id
                   AND snr.user_id = $1
                WHERE (sn.expires_at IS NULL OR sn.expires_at > CURRENT_TIMESTAMP)
                  AND (sn.exclude_user_id IS NULL OR sn.exclude_user_id != $1)
            ) merged
            ORDER BY created_at DESC
            LIMIT $2
        `, [req.user.id, limit]);

        const unreadCountResult = await db.query(`
            SELECT
                (
                    SELECT COUNT(*)
                    FROM notifications
                    WHERE user_id = $1 AND is_read = 0
                ) +
                (
                    SELECT COUNT(*)
                    FROM system_notifications sn
                    LEFT JOIN system_notification_reads snr
                        ON snr.notification_id = sn.id
                       AND snr.user_id = $1
                    WHERE snr.user_id IS NULL
                      AND (sn.expires_at IS NULL OR sn.expires_at > CURRENT_TIMESTAMP)
                      AND (sn.exclude_user_id IS NULL OR sn.exclude_user_id != $1)
                ) AS count
        `, [req.user.id]);

        const unreadCount = unreadCountResult.rows[0] ? Number(unreadCountResult.rows[0].count) : 0;
        res.json({
            notifications: notificationsResult.rows.map(normalizeNotificationRow),
            unread_count: unreadCount,
        });
    } catch (err) {
        console.error('Get notifications error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/:id/read', verifyToken, async (req, res) => {
    try {
        const { scope, id } = parseNotificationId(req.params.id);

        if (scope === 'system') {
            await db.prepare(`
                INSERT INTO system_notification_reads (notification_id, user_id)
                VALUES ($1, $2)
                ON CONFLICT (notification_id, user_id) DO NOTHING
            `).run(id, req.user.id);
        } else {
            await db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?')
                .run(id, req.user.id);
        }

        res.json({ message: 'Marked as read' });
    } catch (err) {
        console.error('Mark notification read error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/read-all', verifyToken, async (req, res) => {
    try {
        await db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?')
            .run(req.user.id);

        await db.prepare(`
            INSERT INTO system_notification_reads (notification_id, user_id)
            SELECT sn.id, $1
            FROM system_notifications sn
            LEFT JOIN system_notification_reads snr
                ON snr.notification_id = sn.id
               AND snr.user_id = $1
            WHERE snr.user_id IS NULL
              AND (sn.expires_at IS NULL OR sn.expires_at > CURRENT_TIMESTAMP)
              AND (sn.exclude_user_id IS NULL OR sn.exclude_user_id != $1)
            ON CONFLICT (notification_id, user_id) DO NOTHING
        `).run(req.user.id);

        res.json({ message: 'All marked as read' });
    } catch (err) {
        console.error('Mark all read error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
