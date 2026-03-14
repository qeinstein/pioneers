import jwt from 'jsonwebtoken';
import db from './db.js';
import { JWT_SECRET } from './middleware/auth.js';

// In-memory session state for active live quizzes
const activeSessions = new Map();

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

    io.on('connection', (socket) => {
        // Join a live session
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

                // Add participant to DB only if NOT the host (initially)
                const isHost = session.host_id === socket.user.id;
                if (!isHost) {
                    await db.prepare('INSERT OR IGNORE INTO live_participants (session_id, user_id) VALUES (?, ?)')
                        .run(session.id, socket.user.id);
                }

                socket.join(`live:${sessionCode}`);
                socket.sessionCode = sessionCode;
                socket.sessionId = session.id;

                const user = await db.prepare('SELECT display_name, matric_no, profile_pic_url FROM users WHERE id = ?').get(socket.user.id);

                // Get updated participant list
                const participants = await getParticipants(session.id);

                socket.emit('joined', {
                    session,
                    user: { ...user, id: socket.user.id },
                    isHost // Inform the client if they are the host
                });

                io.to(`live:${sessionCode}`).emit('participants-update', participants);
            } catch (err) {
                console.error('Socket join session error:', err);
                socket.emit('error', { message: 'Server error joining session' });
            }
        });

        // Host/Participant explicitly joins as a player (for hosts who want to participate)
        socket.on('join-as-player', async () => {
            try {
                if (!socket.sessionId || !socket.user) return;
                await db.prepare('INSERT OR IGNORE INTO live_participants (session_id, user_id) VALUES (?, ?)')
                    .run(socket.sessionId, socket.user.id);

                const participants = await getParticipants(socket.sessionId);
                io.to(`live:${socket.sessionCode}`).emit('participants-update', participants);
            } catch (err) {
                console.error('Socket join-as-player error:', err);
            }
        });

        // Host starts the quiz
        socket.on('start-quiz', async () => {
            try {
                const session = await db.prepare('SELECT * FROM live_sessions WHERE session_code = ? AND host_id = ?')
                    .get(socket.sessionCode, socket.user.id);

                if (!session) { socket.emit('error', { message: 'Not authorized' }); return; }

                await db.prepare("UPDATE live_sessions SET status = 'active', current_question = 0 WHERE id = ?").run(session.id);

                // Load questions into memory
                const questions = await db.prepare(
                    'SELECT id, question_text, option_a, option_b, option_c, option_d, correct_option FROM questions WHERE quiz_id = ? ORDER BY id'
                ).all(session.quiz_id);

                activeSessions.set(socket.sessionCode, {
                    sessionId: session.id,
                    questions,
                    currentIndex: -1,
                    duration: session.question_duration || 20,
                    answers: new Map(),
                    timer: null,
                });

                io.to(`live:${socket.sessionCode}`).emit('quiz-started', { question_count: questions.length });

                // Send first question after 5 seconds to allow for countdown
                const state = activeSessions.get(socket.sessionCode);
                state.timer = setTimeout(async () => {
                    await sendNextQuestion(io, socket.sessionCode);
                }, 5000);
            } catch (err) {
                console.error('Socket start quiz error:', err);
            }
        });

        // Student submits an answer
        socket.on('submit-answer', async ({ question_id, answer, time_ms }) => {
            try {
                const state = activeSessions.get(socket.sessionCode);
                if (!state) return;

                const currentQ = state.questions[state.currentIndex];
                if (!currentQ || currentQ.id !== question_id) return;

                // Prevent duplicate answers
                const key = `${socket.user.id}:${question_id}`;
                if (state.answers.has(key)) return;

                const is_correct = answer === currentQ.correct_option ? 1 : 0;

                // Scoring: base 1000 × speed multiplier + streak bonus
                const maxTime = state.duration * 1000;
                const speedMultiplier = Math.max(0, (maxTime - time_ms) / maxTime);
                let points = is_correct ? Math.round(1000 * speedMultiplier) : 0;

                // Streak bonus
                const participant = await db.prepare('SELECT streak FROM live_participants WHERE session_id = ? AND user_id = ?')
                    .get(state.sessionId, socket.user.id);

                if (is_correct && participant && participant.streak >= 1) {
                    points += 200; // streak bonus
                }

                // Update streak
                if (is_correct) {
                    await db.prepare('UPDATE live_participants SET streak = streak + 1 WHERE session_id = ? AND user_id = ?')
                        .run(state.sessionId, socket.user.id);
                } else {
                    await db.prepare('UPDATE live_participants SET streak = 0 WHERE session_id = ? AND user_id = ?')
                        .run(state.sessionId, socket.user.id);
                }

                // Save answer
                await db.prepare(
                    'INSERT INTO live_answers (session_id, user_id, question_id, answer, time_ms, is_correct, points) VALUES (?, ?, ?, ?, ?, ?, ?)'
                ).run(state.sessionId, socket.user.id, question_id, answer, time_ms, is_correct, points);

                // Update total score
                await db.prepare('UPDATE live_participants SET total_score = total_score + ?, total_time = total_time + ? WHERE session_id = ? AND user_id = ?')
                    .run(points, time_ms, state.sessionId, socket.user.id);

                state.answers.set(key, true);

                // Tell this student their result
                socket.emit('answer-result', { is_correct, points, correct_option: currentQ.correct_option });

                // Check if all participants have answered
                const participantCountRow = await db.prepare('SELECT COUNT(*) as c FROM live_participants WHERE session_id = ?').get(state.sessionId);
                const participantCount = participantCountRow ? Number(participantCountRow.c) : 0;
                const answersThisQ = [...state.answers.keys()].filter(k => k.endsWith(`:${question_id}`)).length;

                // Notify host of answer count
                io.to(`live:${socket.sessionCode}`).emit('answer-count', {
                    answered: answersThisQ,
                    total: participantCount,
                });

                if (answersThisQ >= participantCount) {
                    // All answered — advance faster
                    clearTimeout(state.timer);
                    setTimeout(() => showQuestionResults(io, socket.sessionCode), 1000);
                }
            } catch (err) {
                console.error('Socket submit answer error:', err);
            }
        });

        // Host forces next question
        socket.on('next-question', async () => {
            const state = activeSessions.get(socket.sessionCode);
            if (!state) return;
            clearTimeout(state.timer);
            await sendNextQuestion(io, socket.sessionCode);
        });

        socket.on('disconnect', async () => {
            if (socket.sessionCode && socket.sessionId) {
                try {
                    const participants = await getParticipants(socket.sessionId);
                    io.to(`live:${socket.sessionCode}`).emit('participants-update', participants);
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

        state.currentIndex++;

        if (state.currentIndex >= state.questions.length) {
            await endQuiz(io, code);
            return;
        }

        const q = state.questions[state.currentIndex];
        await db.prepare('UPDATE live_sessions SET current_question = ? WHERE id = ?').run(state.currentIndex, state.sessionId);

        // Broadcast question (WITHOUT correct answer)
        io.to(`live:${code}`).emit('question', {
            index: state.currentIndex,
            total: state.questions.length,
            question_id: q.id,
            question_text: q.question_text,
            option_a: q.option_a,
            option_b: q.option_b,
            option_c: q.option_c,
            option_d: q.option_d,
            duration: state.duration,
        });

        // Timer — auto-show results after duration
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
        if (!state) return;

        const q = state.questions[state.currentIndex];
        const leaderboard = await getParticipants(state.sessionId);

        // Get answer distribution
        const answers = await db.prepare(
            'SELECT answer, COUNT(*) as cnt FROM live_answers WHERE session_id = ? AND question_id = ? GROUP BY answer'
        ).all(state.sessionId, q.id);

        const distribution = { a: 0, b: 0, c: 0, d: 0 };
        answers.forEach(a => { if (a.answer) distribution[a.answer] = Number(a.cnt); });

        io.to(`live:${code}`).emit('question-results', {
            correct_option: q.correct_option,
            distribution,
            leaderboard: leaderboard.slice(0, 10),
            is_last: state.currentIndex >= state.questions.length - 1,
        });

        // Auto-advance to next question after 5 seconds
        if (state.currentIndex < state.questions.length - 1) {
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

        clearTimeout(state.timer);
        await db.prepare("UPDATE live_sessions SET status = 'finished' WHERE id = ?").run(state.sessionId);

        const finalLeaderboard = await getParticipants(state.sessionId);

        // Save as regular quiz attempts for each participant
        const session = await db.prepare('SELECT quiz_id FROM live_sessions WHERE id = ?').get(state.sessionId);
        const totalQuestions = state.questions.length;

        for (const p of finalLeaderboard) {
            const correctCountRow = await db.prepare(
                'SELECT COUNT(*) as c FROM live_answers WHERE session_id = ? AND user_id = ? AND is_correct = 1'
            ).get(state.sessionId, p.user_id);
            const correctCount = correctCountRow ? Number(correctCountRow.c) : 0;

            await db.prepare(
                'INSERT INTO attempts (user_id, quiz_id, score, total_questions, time_spent) VALUES (?, ?, ?, ?, ?)'
            ).run(p.user_id, session.quiz_id, correctCount, totalQuestions, Math.round(p.total_time / 1000));
        }

        // Increment times_taken
        await db.prepare('UPDATE quizzes SET times_taken = times_taken + ? WHERE id = ?').run(finalLeaderboard.length, session.quiz_id);

        io.to(`live:${code}`).emit('quiz-ended', { leaderboard: finalLeaderboard });

        activeSessions.delete(code);
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
