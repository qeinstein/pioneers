import express from 'express';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import db from './db.js';
import { setupLiveSocket } from './liveSocket.js';
import authRoutes from './routes/auth.js';
import courseRoutes from './routes/courses.js';
import quizRoutes from './routes/quizzes.js';
import leaderboardRoutes from './routes/leaderboard.js';
import commentRoutes from './routes/comments.js';
import suggestionRoutes from './routes/suggestions.js';
import bookmarkRoutes from './routes/bookmarks.js';
import notificationRoutes from './routes/notifications.js';
import adminRoutes from './routes/admin.js';
import liveRoutes from './routes/live.js';
import marketplaceRoutes from './routes/marketplace.js';
import flashcardRoutes from './routes/flashcards.js';
import pollRoutes from './routes/polls.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
});

const PORT = process.env.PORT || 3001;

// Trust proxy for correct client IP detection behind reverse proxies (like Render)
app.set('trust proxy', 1);

// Checking db on startup
// Only run seed if no ad min exists (not if database is empty)
(async () => {
    try {
        const adminCountResult = await db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('admin');
        const adminCount = adminCountResult ? Number(adminCountResult.count) : 0;
        console.log('Admin count:', adminCount);
    } catch (err) {
        console.error('Error checking database:', err);
    }
})();

// Logging
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve frontend build in production
const distPath = join(__dirname, '..', 'dist');
app.use(express.static(distPath, { maxAge: '7d', etag: true }));
app.use('/uploads', express.static(join(__dirname, 'uploads'), {
    maxAge: '7d',
    etag: true,
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/suggestions', suggestionRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/live', liveRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/flashcards', flashcardRoutes);
app.use('/api/polls', pollRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Internal pinging for uptime (prevents free Render app from sleeping)
// Only run on Render (where PORT is set)
if (process.env.RENDER) {
    import('https').then(https => {
        const PING_URL = `https://pioneers-cq56.onrender.com/api/health`;
        const PING_INTERVAL = 20 * 1000; // 20 seconds

        setInterval(() => {
            https.get(PING_URL, (res) => {
                console.log(`[Uptime Ping] ${new Date().toISOString()} - Status: ${res.statusCode}`);
            }).on('error', (err) => {
                console.error('[Uptime Ping] Error:', err.message);
            });
        }, PING_INTERVAL);

        console.log(`Internal uptime pinger started: pinging ${PING_URL} every 20 seconds`);
    });
}

// SPA fallback — serve index.html for all non-API routes (production)
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(join(distPath, 'index.html'));
    }
});

// Setup Socket.IO for live quizzes
setupLiveSocket(io);

httpServer.listen(PORT, () => {
    console.log(`Pioneers Quiz Portal running on http://localhost:${PORT}`);
});
