import express from 'express';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import './db.js';
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
