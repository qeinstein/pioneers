import jwt from 'jsonwebtoken';
import db from './db.js';
import { JWT_SECRET } from './middleware/auth.js';

const activeSessions = new Map();
const ACTIVE_SESSION_TTL_MS = 15 * 60 * 1000;
const ACTIVE_SESSION_CLEANUP_MS = 60 * 1000;

function touchState(state) {
    if (state) state.lastTouched = Date.now();
}

function clearSessionTimer(state) {
    if (state?.timer) {
        clearTimeout(state.timer);
        state.timer = null;
    }
}

async function cleanupAbandonedSession(code, reason) {
    const state = activeSessions.get(code);
    if (!state) return;

    clearSessionTimer(state);
    activeSessions.delete(code);

    try {
        await db.prepare("UPDATE live_sessions SET status = 'finished' WHERE id = ? AND status != 'finished'")
            .run(state.sessionId);
        console.warn(`Cleaned up abandoned live session ${code}: ${reason}`);
    } catch (err) {
        console.error(`Failed to clean up abandoned live session ${code}:`, err);
    }
}

// In-memory ready state: sessionCode -> Set of ready user_ids
const readySessions = new Map();

async function broadcastParticipants(io, code, sessionId) {
    const participants = await getParticipants(sessionId);
    const readySet = readySessions.get(code) || new Set();
    const readyStrings = new Set([...readySet].map(String));
    const withReady = participants.map(p => ({ ...p, is_ready: readyStrings.has(String(p.user_id)) }));
    io.to(`live:${code}`).emit('participants-update', withReady);
    return withReady;
}

export function setupLiveSocket(io) {
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error('Authentication required'));

        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            socket.user = decoded;
            next();
        } catch {
            next(new Error('Invalid token'));
        }
    });

    setInterval(() => {
        const now = Date.now();
        for (const [code, state] of activeSessions.entries()) {
            if (now - state.lastTouched > ACTIVE_SESSION_TTL_MS) {
                cleanupAbandonedSession(code, 'inactive timeout');
            }
        }
    }, ACTIVE_SESSION_CLEANUP_MS);

    io.on('connection', (socket) => {
        socket.on('join-session', async ({ code }) => {
            try {
                const sessionCode = code.toUpperCase();
                const session = await db.prepare(`
                    SELECT ls.*, q.title as quiz_title,
                           (SELECT COUNT(*) FROM questions WHERE quiz_id = ls.quiz_id) as question_count
                    FROM live_sessions ls
                    JOIN quizzes q ON ls.quiz_id = q.id
                    WHERE ls.session_code = ? AND ls.status != 'finished'
                `).get(sessionCode);

                if (!session) {
                    socket.emit('error', { message: 'Session not found' });
                    return;
                }

                const isHost = session.host_id === socket.user.id;
                if (!isHost) {
                    await db.prepare('INSERT OR IGNORE INTO live_participants (session_id, user_id) VALUES (?, ?)')
                        .run(session.id, socket.user.id);
                }

                socket.join(`live:${sessionCode}`);
                socket.sessionCode = sessionCode;
                socket.sessionId = session.id;

                const state = activeSessions.get(sessionCode);
                touchState(state);

                const user = await db.prepare('SELECT display_name, matric_no, profile_pic_url FROM users WHERE id = ?')
                    .get(socket.user.id);
                const participants = await getParticipants(session.id);

                socket.emit('joined', {
                    session,
                    user: { ...user, id: socket.user.id },
                    isHost,
                });

                await broadcastParticipants(io, sessionCode, session.id);
            } catch (err) {
                console.error('Socket join session error:', err);
                socket.emit('error', { message: 'Server error joining session' });
            }
        });

        socket.on('join-as-player', async () => {
            try {
                if (!socket.sessionId || !socket.user) return;

                await db.prepare('INSERT OR IGNORE INTO live_participants (session_id, user_id) VALUES (?, ?)')
                    .run(socket.sessionId, socket.user.id);

                const state = activeSessions.get(socket.sessionCode);
                touchState(state);

                const participants = await getParticipants(socket.sessionId);
                io.to(`live:${socket.sessionCode}`).emit('participants-update', participants);
            } catch (err) {
                console.error('Socket join-as-player error:', err);
            }
        });

        // Player marks themselves as ready
        socket.on('player-ready', async () => {
            try {
                if (!socket.sessionCode || !socket.sessionId) return;
                const code = socket.sessionCode;
                if (!readySessions.has(code)) readySessions.set(code, new Set());
                readySessions.get(code).add(String(socket.user.id));
                await broadcastParticipants(io, code, socket.sessionId);
            } catch (err) {
                console.error('Socket player-ready error:', err);
            }
        });

        // Player unmarks ready
        socket.on('player-unready', async () => {
            try {
                if (!socket.sessionCode || !socket.sessionId) return;
                readySessions.get(socket.sessionCode)?.delete(String(socket.user.id));
                await broadcastParticipants(io, socket.sessionCode, socket.sessionId);
            } catch (err) {
                console.error('Socket player-unready error:', err);
            }
        });

        socket.on('start-quiz', async () => {
            try {
                const session = await db.prepare('SELECT * FROM live_sessions WHERE session_code = ? AND host_id = ?')
                    .get(socket.sessionCode, socket.user.id);

                if (!session) {
                    socket.emit('error', { message: 'Not authorized' });
                    return;
                }

                await db.prepare("UPDATE live_sessions SET status = 'active', current_question = 0 WHERE id = ?")
                    .run(session.id);

                const questionRows = await db.prepare(
                    'SELECT id FROM questions WHERE quiz_id = ? ORDER BY id'
                ).all(session.quiz_id);

                const questionIds = questionRows.map(row => row.id);

                const existingState = activeSessions.get(socket.sessionCode);
                if (existingState) clearSessionTimer(existingState);

                activeSessions.set(socket.sessionCode, {
                    sessionId: session.id,
                    quizId: session.quiz_id,
                    questionIds,
                    totalQuestions: questionIds.length,
                    currentIndex: -1,
                    currentQuestion: null,
                    duration: session.question_duration || 20,
                    answeredUsers: new Set(),
                    answeredCount: 0,
                    phase: 'starting',
                    timer: null,
                    lastTouched: Date.now(),
                });

                io.to(`live:${socket.sessionCode}`).emit('quiz-started', { question_count: questionIds.length });

                const state = activeSessions.get(socket.sessionCode);
                state.timer = setTimeout(async () => {
                    await sendNextQuestion(io, socket.sessionCode);
                }, 5000);
            } catch (err) {
                console.error('Socket start quiz error:', err);
            }
        });

        socket.on('submit-answer', async ({ question_id, answer, time_ms }) => {
            try {
                const state = activeSessions.get(socket.sessionCode);
                if (!state || state.phase !== 'question') return;

                touchState(state);

                const currentQ = state.currentQuestion;
                if (!currentQ || currentQ.id !== question_id) return;

                if (state.answeredUsers.has(socket.user.id)) return;

                const isCorrect = answer === currentQ.correct_option ? 1 : 0;
                const maxTime = state.duration * 1000;
                const safeTime = Math.max(0, Math.min(Number(time_ms) || 0, maxTime));
                const speedMultiplier = Math.max(0, (maxTime - safeTime) / maxTime);
                let points = isCorrect ? Math.round(1000 * speedMultiplier) : 0;

                const participant = await db.prepare('SELECT streak FROM live_participants WHERE session_id = ? AND user_id = ?')
                    .get(state.sessionId, socket.user.id);

                if (isCorrect && participant && participant.streak >= 1) {
                    points += 200;
                }

                if (isCorrect) {
                    await db.prepare('UPDATE live_participants SET streak = streak + 1 WHERE session_id = ? AND user_id = ?')
                        .run(state.sessionId, socket.user.id);
                } else {
                    await db.prepare('UPDATE live_participants SET streak = 0 WHERE session_id = ? AND user_id = ?')
                        .run(state.sessionId, socket.user.id);
                }

                await db.prepare(
                    'INSERT INTO live_answers (session_id, user_id, question_id, answer, time_ms, is_correct, points) VALUES (?, ?, ?, ?, ?, ?, ?)'
                ).run(state.sessionId, socket.user.id, question_id, answer, safeTime, isCorrect, points);

                await db.prepare('UPDATE live_participants SET total_score = total_score + ?, total_time = total_time + ? WHERE session_id = ? AND user_id = ?')
                    .run(points, safeTime, state.sessionId, socket.user.id);

                state.answeredUsers.add(socket.user.id);
                state.answeredCount += 1;

                socket.emit('answer-result', { is_correct: isCorrect, points, correct_option: currentQ.correct_option });

                const participantCountRow = await db.prepare('SELECT COUNT(*) as c FROM live_participants WHERE session_id = ?')
                    .get(state.sessionId);
                const participantCount = participantCountRow ? Number(participantCountRow.c) : 0;

                io.to(`live:${socket.sessionCode}`).emit('answer-count', {
                    answered: state.answeredCount,
                    total: participantCount,
                });

                if (participantCount > 0 && state.answeredCount >= participantCount) {
                    state.phase = 'results_pending';
                    clearSessionTimer(state);
                    state.timer = setTimeout(() => showQuestionResults(io, socket.sessionCode), 1000);
                }
            } catch (err) {
                console.error('Socket submit answer error:', err);
            }
        });

        socket.on('next-question', async () => {
            const state = activeSessions.get(socket.sessionCode);
            if (!state) return;

            touchState(state);
            clearSessionTimer(state);
            await sendNextQuestion(io, socket.sessionCode);
        });

        socket.on('disconnect', async () => {
            const state = activeSessions.get(socket.sessionCode);
            touchState(state);

            if (socket.sessionCode && socket.sessionId) {
                try {
                    // Remove from ready set
                    readySessions.get(socket.sessionCode)?.delete(String(socket.user.id));
                    await broadcastParticipants(io, socket.sessionCode, socket.sessionId);
                } catch (err) {
                    console.error('Socket disconnect update error:', err);
                }
            }
        });
    });
}

async function sendNextQuestion(io, code) {
    try {
        const state = activeSessions.get(code);
        if (!state) return;

        touchState(state);

        state.currentIndex += 1;
        state.answeredUsers.clear();
        state.answeredCount = 0;

        if (state.currentIndex >= state.questionIds.length) {
            await endQuiz(io, code);
            return;
        }

        const questionId = state.questionIds[state.currentIndex];
        const q = await db.prepare(
            'SELECT id, question_text, option_a, option_b, option_c, option_d, correct_option FROM questions WHERE id = ?'
        ).get(questionId);

        if (!q) {
            await endQuiz(io, code);
            return;
        }

        state.currentQuestion = q;
        state.phase = 'question';

        await db.prepare('UPDATE live_sessions SET current_question = ? WHERE id = ?')
            .run(state.currentIndex, state.sessionId);

        io.to(`live:${code}`).emit('question', {
            index: state.currentIndex,
            total: state.totalQuestions,
            question_id: q.id,
            question_text: q.question_text,
            option_a: q.option_a,
            option_b: q.option_b,
            option_c: q.option_c,
            option_d: q.option_d,
            duration: state.duration,
        });

        clearSessionTimer(state);
        state.timer = setTimeout(() => {
            showQuestionResults(io, code);
        }, (state.duration + 1) * 1000);
    } catch (err) {
        console.error('Socket send next question error:', err);
    }
}

async function showQuestionResults(io, code) {
    try {
        const state = activeSessions.get(code);
        if (!state || !state.currentQuestion) return;

        touchState(state);
        state.phase = 'results';

        const q = state.currentQuestion;
        const leaderboard = await getParticipants(state.sessionId);
        const answers = await db.prepare(
            'SELECT answer, COUNT(*) as cnt FROM live_answers WHERE session_id = ? AND question_id = ? GROUP BY answer'
        ).all(state.sessionId, q.id);

        const distribution = { a: 0, b: 0, c: 0, d: 0 };
        answers.forEach(row => {
            if (row.answer && Object.prototype.hasOwnProperty.call(distribution, row.answer)) {
                distribution[row.answer] = Number(row.cnt);
            }
        });

        io.to(`live:${code}`).emit('question-results', {
            correct_option: q.correct_option,
            distribution,
            leaderboard: leaderboard.slice(0, 10),
            is_last: state.currentIndex >= state.questionIds.length - 1,
        });

        state.currentQuestion = null;
        state.answeredUsers.clear();
        state.answeredCount = 0;

        clearSessionTimer(state);
        if (state.currentIndex < state.questionIds.length - 1) {
            state.timer = setTimeout(() => {
                sendNextQuestion(io, code);
            }, 5000);
        } else {
            state.timer = setTimeout(() => {
                endQuiz(io, code);
            }, 5000);
        }
    } catch (err) {
        console.error('Socket show question results error:', err);
    }
}

async function endQuiz(io, code) {
    try {
        const state = activeSessions.get(code);
        if (!state) return;

        clearSessionTimer(state);

        await db.prepare("UPDATE live_sessions SET status = 'finished' WHERE id = ?")
            .run(state.sessionId);

        const finalLeaderboard = await getParticipants(state.sessionId);
        const session = await db.prepare('SELECT quiz_id FROM live_sessions WHERE id = ?').get(state.sessionId);
        const totalQuestions = state.totalQuestions;

        for (const participant of finalLeaderboard) {
            const correctCountRow = await db.prepare(
                'SELECT COUNT(*) as c FROM live_answers WHERE session_id = ? AND user_id = ? AND is_correct = 1'
            ).get(state.sessionId, participant.user_id);
            const correctCount = correctCountRow ? Number(correctCountRow.c) : 0;

            await db.prepare(
                'INSERT INTO attempts (user_id, quiz_id, score, total_questions, time_spent) VALUES (?, ?, ?, ?, ?)'
            ).run(participant.user_id, session.quiz_id, correctCount, totalQuestions, Math.round(participant.total_time / 1000));
        }

        await db.prepare('UPDATE quizzes SET times_taken = times_taken + ? WHERE id = ?')
            .run(finalLeaderboard.length, session.quiz_id);

        io.to(`live:${code}`).emit('quiz-ended', { leaderboard: finalLeaderboard });

        activeSessions.delete(code);
        readySessions.delete(code);
    } catch (err) {
        console.error('Socket end quiz error:', err);
    }
}

async function getParticipants(sessionId) {
    return await db.prepare(`
        SELECT lp.user_id, lp.total_score, lp.total_time, lp.streak,
               u.display_name, u.matric_no, u.profile_pic_url
        FROM live_participants lp
        JOIN users u ON lp.user_id = u.id
        WHERE lp.session_id = ?
        ORDER BY lp.total_score DESC
    `).all(sessionId);
}
