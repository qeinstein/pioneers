import { Router } from 'express';
import db from '../db.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

// GET /api/anonymous - Fetch all anonymous messages sorted by newest
router.get('/', verifyToken, async (req, res) => {
    try {
        const messages = await db.prepare(`
            SELECT am.id, am.user_id, am.content, am.created_at, u.display_name, u.matric_no, u.profile_pic_url
            FROM anonymous_messages am
            JOIN users u ON am.user_id = u.id
            ORDER BY am.created_at DESC
        `).all();
        
        // Hide actual user details to keep it anonymous, only send content and created_at
        // Optional: If users can see who wrote it, omit anonymity mapping. Since it's an "anonymous message board", 
        // we map sender to a generic "Anonymous" for the frontend unless we decide differently.
        const anonymous_feed = messages.map(msg => ({
            id: msg.id,
            content: msg.content,
            created_at: msg.created_at,
            author: "Anonymous",
            avatar: null
        }));

        res.json({ messages: anonymous_feed });
    } catch (err) {
        console.error('Get anonymous messages error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/anonymous - Create a new message and process tags
router.post('/', verifyToken, async (req, res) => {
    try {
        const { content } = req.body;
        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Message content cannot be empty' });
        }

        // Insert the new anonymous message
        const result = await db.prepare(
            'INSERT INTO anonymous_messages (user_id, content) VALUES (?, ?)'
        ).run(req.user.id, content);

        const newMsgId = result.lastInsertRowid;

        // Parse @matric_no tags
        // Regex matches @ followed by alphanumeric characters (assuming matric numbers don't contain spaces)
        const tagRegex = /@([a-zA-Z0-9]+)/g;
        const matches = [...content.matchAll(tagRegex)];
        const taggedMatrics = matches.map(m => m[1]);

        // Process notifications for each unique tagged user
        if (taggedMatrics.length > 0) {
            const uniqueMatrics = [...new Set(taggedMatrics)];
            
            for (const matric of uniqueMatrics) {
                // Find the user by matric_no
                const taggedUser = await db.prepare('SELECT id FROM users WHERE matric_no = ?').get(matric);
                
                if (taggedUser) {
                    // Create notification for the tagged user
                    await db.prepare(`
                        INSERT INTO notifications (user_id, type, message, reference_id)
                        VALUES (?, ?, ?, ?)
                    `).run(
                        taggedUser.id, 
                        'anonymous_tag', 
                        `You were tagged in an anonymous message.`, 
                        newMsgId
                    );
                }
            }
        }

        res.status(201).json({ message: 'Message posted anonymously', id: newMsgId });
    } catch (err) {
        console.error('Create anonymous message error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
