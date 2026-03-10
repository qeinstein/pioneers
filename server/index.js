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

// Auto-create admin user if none exists
function ensureAdminUser() {
    try {
        const adminCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('admin');
        if (adminCount.count === 0) {
            console.log('No admin user found. Creating default admin...');
            db.prepare(`
                INSERT INTO users (matric_no, password, display_name, role, is_first_login)
                VALUES (?, ?, ?, 'admin', 0)
            `).run('240805099', 'admin', 'Admin');
            console.log('Default admin created: 240805099 / admin');
        } else {
            console.log(`Found ${adminCount.count} admin user(s). Skipping creation.`);
        }
    } catch (err) {
        console.error('Error ensuring admin user:', err);
    }
}

// Run admin check on startup
// Only run seed if database is empty (first time setup)
// BUT: Only do this if we're NOT on Render (to prevent accidental wipes)
if (!process.env.RENDER) {
    try {
        const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
        if (userCount === 0) {
            console.log('Database is empty. Running seed...');
            ensureAdminUser();
        } else {
            console.log(`Database has ${userCount} users. Skipping seed.`);
        }
    } catch (err) {
        console.error('Error checking database:', err);
    }
} else {
    // On Render, just check for admin existence without seeding
    try {
        const adminCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('admin');
        if (adminCount.count === 0) {
            console.log('WARNING: No admin user found on Render! Database might be empty.');
            console.log('To fix: Run "node server/seed.js" manually in Render shell or use Render CLI.');
        } else {
            console.log(`Found ${adminCount.count} admin user(s). Database is OK.`);
        }
    } catch (err) {
        console.error('Error checking database:', err);
    }
}

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
