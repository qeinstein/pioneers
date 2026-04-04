import { Router } from 'express';
import db from '../db.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';
import { uploadMarketplace } from '../cloudinary.js';
import { getPagination, setPaginationHeaders } from '../utils/pagination.js';

const router = Router();

// POST /api/marketplace/upload — Upload up to 3 images via Cloudinary
router.post('/upload', verifyToken, uploadMarketplace.array('images', 3), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }
        const urls = req.files.map(f => f.path);
        res.json({ urls });
    } catch (err) {
        console.error('Marketplace upload error:', err);
        res.status(500).json({ error: 'Upload failed' });
    }
});

// GET /api/marketplace - Get approved items (or all if admin)
router.get('/', verifyToken, async (req, res) => {
    try {
        const { status, search = '' } = req.query;
        const { page, limit, offset } = getPagination(req.query, { defaultLimit: 24, maxLimit: 100 });
        const filters = [];
        const params = [];

        if (req.user.role === 'admin') {
            if (status) {
                filters.push('m.status = ?');
                params.push(status);
            }
        } else {
            filters.push("(m.status = 'approved' OR m.user_id = ?)");
            params.push(req.user.id);
        }

        if (search.trim()) {
            filters.push('(m.title ILIKE ? OR m.description ILIKE ?)');
            params.push(`%${search.trim()}%`, `%${search.trim()}%`);
        }

        const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
        const countRow = await db.prepare(`
            SELECT COUNT(*) as count
            FROM marketplace_items m
            ${whereClause}
        `).get(...params);

        const items = await db.prepare(`
            SELECT m.*, u.display_name, u.matric_no
            FROM marketplace_items m
            JOIN users u ON m.user_id = u.id
            ${whereClause}
            ORDER BY m.created_at DESC
            LIMIT ? OFFSET ?
        `).all(...params, limit, offset);

        setPaginationHeaders(res, {
            page,
            limit,
            total: countRow ? Number(countRow.count) : 0,
        });

        res.json(items);
    } catch (err) {
        console.error('Get marketplace error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/marketplace - Create item
router.post('/', verifyToken, async (req, res) => {
    try {
        const { title, description, price, contact_info, image_url_1, image_url_2, image_url_3 } = req.body;
        if (!title || !price || !contact_info) {
            return res.status(400).json({ error: 'Title, price, and contact info are required' });
        }

        const result = await db.prepare(`
            INSERT INTO marketplace_items (
                user_id, title, description, price, contact_info, image_url_1, image_url_2, image_url_3
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            req.user.id, title, description || '', price, contact_info,
            image_url_1 || null, image_url_2 || null, image_url_3 || null
        );

        const item = await db.prepare('SELECT * FROM marketplace_items WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(item);
    } catch (err) {
        console.error('Create marketplace item error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/marketplace/:id/status - Admin approve/reject
router.put('/:id/status', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        if (!['approved', 'rejected', 'pending'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const result = await db.prepare('UPDATE marketplace_items SET status = ? WHERE id = ?').run(status, req.params.id);
        if (result.changes === 0) return res.status(404).json({ error: 'Item not found' });

        res.json({ message: `Item ${status}` });
    } catch (err) {
        console.error('Update status error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/marketplace/:id
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        let result;
        if (req.user.role === 'admin') {
            result = await db.prepare('DELETE FROM marketplace_items WHERE id = ?').run(req.params.id);
        } else {
            result = await db.prepare('DELETE FROM marketplace_items WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
        }

        if (result.changes === 0) return res.status(404).json({ error: 'Item not found or unauthorized' });

        res.json({ message: 'Item deleted successfully' });
    } catch (err) {
        console.error('Delete item error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
