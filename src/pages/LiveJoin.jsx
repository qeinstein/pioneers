import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import MathText from '../components/MathText';

// Component for individual quiz setup in the list
function QuizSetupItem({ quiz, onCreate, disabled }) {
    const [duration, setDuration] = useState(20);

    return (
        <div style={{
            padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)', marginBottom: 'var(--space-2)',
            background: 'var(--bg-card)',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                <div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>{quiz.title}</div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>{quiz.course_code} — {quiz.question_count || '?'} questions</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <label style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Time/Question:</label>
                    <input
                        type="number"
                        min="5"
                        max="60"
                        value={duration}
                        onChange={e => setDuration(parseInt(e.target.value) || 20)}
                        style={{ width: '50px', padding: '4px 8px', textAlign: 'center' }}
                        disabled={disabled}
                    />
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={() => onCreate(quiz.id, duration)}
                        disabled={disabled}
                    >
                        Host
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function LiveJoin() {
    const params = useParams();
    const navigate = useNavigate();
    const { token, user } = useAuth();
    const socketRef = useRef(null);
    const [joinCode, setJoinCode] = useState(params.code || '');
    const [session, setSession] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [phase, setPhase] = useState(params.code ? 'joining' : 'enter-code');
    const [question, setQuestion] = useState(null);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [answerResult, setAnswerResult] = useState(null);
    const [questionResults, setQuestionResults] = useState(null);
    const [finalLeaderboard, setFinalLeaderboard] = useState([]);
    const [countdown, setCountdown] = useState(0);
    const [error, setError] = useState('');
    const [totalScore, setTotalScore] = useState(0);
    // Create flow
    const [showCreate, setShowCreate] = useState(false);
    const [quizzes, setQuizzes] = useState([]);
    const [creating, setCreating] = useState(false);
    const [loadingQuizzes, setLoadingQuizzes] = useState(false);
    const timerRef = useRef(null);
    const answerStartRef = useRef(null);
    const joinTimeoutRef = useRef(null);

    const connectSocket = useCallback((code) => {
        if (socketRef.current) socketRef.current.disconnect();
        setError('');

        const socket = io('/', { auth: { token }, timeout: 5000, reconnectionAttempts: 3 });
        socketRef.current = socket;

        // Timeout for joining — if no response in 8 seconds, show error
        joinTimeoutRef.current = setTimeout(() => {
            if (phase === 'joining' && !session) {
                setError('Could not connect. Please check the code and try again.');
                setPhase('enter-code');
                socket.disconnect();
            }
        }, 8000);

        socket.on('connect_error', () => {
            clearTimeout(joinTimeoutRef.current);
            setError('Connection failed. Please try again.');
            setPhase('enter-code');
        });

        socket.on('connect', () => {
            socket.emit('join-session', { code: code.toUpperCase() });
        });

        socket.on('joined', ({ session: s }) => {
            clearTimeout(joinTimeoutRef.current);
            setSession(s);
            setPhase(s.status === 'waiting' ? 'waiting' : 'waiting');
            setError('');
        });

        socket.on('error', ({ message }) => {
            clearTimeout(joinTimeoutRef.current);
            setError(message || 'Session not found. Check the code and try again.');
            setPhase('enter-code');
            socket.disconnect();
        });

        socket.on('participants-update', (p) => setParticipants(p));
        socket.on('quiz-started', () => { setPhase('question'); });
        socket.on('question', (q) => {
            setQuestion(q);
            setSelectedAnswer(null);
            setAnswerResult(null);
            setPhase('question');
            setCountdown(q.duration);
            answerStartRef.current = Date.now();
            clearInterval(timerRef.current);
            timerRef.current = setInterval(() => setCountdown(c => {
                if (c <= 1) { clearInterval(timerRef.current); return 0; }
                return c - 1;
            }), 1000);
        });
        socket.on('answer-result', (r) => {
            setAnswerResult(r);
            setTotalScore(s => s + r.points);
            setPhase('answered');
            clearInterval(timerRef.current);
        });
        socket.on('question-results', (r) => {
            setQuestionResults(r);
            setPhase('results');
            clearInterval(timerRef.current);
        });
        socket.on('quiz-ended', ({ leaderboard }) => {
            setFinalLeaderboard(leaderboard);
            setPhase('ended');
            clearInterval(timerRef.current);
        });

        return () => { socket.disconnect(); clearInterval(timerRef.current); clearTimeout(joinTimeoutRef.current); };
    }, [token]);

    useEffect(() => {
        if (params.code) connectSocket(params.code);
        return () => { socketRef.current?.disconnect(); clearInterval(timerRef.current); clearTimeout(joinTimeoutRef.current); };
    }, [params.code]);

    function handleJoin() {
        if (!joinCode.trim() || joinCode.trim().length < 4) {
            setError('Enter a valid 6-character session code');
            return;
        }
        setPhase('joining');
        setError('');
        connectSocket(joinCode.trim());
    }

    function submitAnswer(opt) {
        if (selectedAnswer || !question) return;
        setSelectedAnswer(opt);
        const time_ms = Date.now() - answerStartRef.current;
        socketRef.current?.emit('submit-answer', { question_id: question.question_id, answer: opt, time_ms });
    }

    async function loadQuizzes() {
        setShowCreate(true);
        setLoadingQuizzes(true);
        try {
            const res = await fetch('/api/quizzes?status=approved', { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) setQuizzes(await res.json());
        } catch { setQuizzes([]); }
        setLoadingQuizzes(false);
    }

    async function createSession(quizId, duration = 20) {
        setCreating(true);
        try {
            const res = await fetch('/api/live/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ quiz_id: quizId, question_duration: duration }),
            });
            const data = await res.json();
            if (res.ok) {
                navigate(`/live/host/${data.session_code}`);
            } else {
                setError(data.error || 'Failed to create session');
            }
        } catch { setError('Failed to create session'); }
        setCreating(false);
    }

    // ENTER CODE / CREATE SCREEN
    if (phase === 'enter-code' || (phase === 'joining' && !session)) {
        return (
            <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <div className="card-static animate-scale-in" style={{ maxWidth: '500px', width: '100%', textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-8)' }}>
                    <h1 style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>Live Quiz</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)', marginBottom: 'var(--space-6)' }}>Join a session or create your own</p>

                    {error && <div style={{ padding: 'var(--space-3)', background: 'var(--error-soft)', color: 'var(--error)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', marginBottom: 'var(--space-4)' }}>{error}</div>}

                    <input className="form-input" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                        placeholder="Enter session code" maxLength={6}
                        style={{ textAlign: 'center', fontSize: 'var(--font-xl)', fontFamily: 'var(--font-mono)', letterSpacing: '0.15em', fontWeight: 700, marginBottom: 'var(--space-3)' }}
                        onKeyDown={e => e.key === 'Enter' && handleJoin()} />
                    <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={handleJoin}
                        disabled={!joinCode.trim() || phase === 'joining'}>
                        {phase === 'joining' ? 'Joining...' : 'Join Session'}
                    </button>

                    <div style={{ margin: 'var(--space-6) 0', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
                        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-xs)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>or</span>
                        <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
                    </div>

                    {!showCreate ? (
                        <button className="btn btn-ghost" style={{ width: '100%' }} onClick={loadQuizzes}>
                            Host a Live Quiz
                        </button>
                    ) : (
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-3)' }}>
                                Select a quiz to host
                            </div>
                            {loadingQuizzes ? (
                                <div style={{ padding: 'var(--space-4)', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }}></div></div>
                            ) : quizzes.length === 0 ? (
                                <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>
                                    No approved quizzes available. Create one first.
                                </div>
                            ) : (
                                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                    {quizzes.map(q => (
                                        <QuizSetupItem key={q.id} quiz={q} onCreate={createSession} disabled={creating} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // WAITING ROOM (student view)
    if (phase === 'waiting') {
        return (
            <div className="page-container" style={{ textAlign: 'center' }}>
                <div className="card-static animate-scale-in" style={{ maxWidth: '500px', margin: '0 auto', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-8)' }}>
                    <div className="spinner" style={{ margin: '0 auto var(--space-4)' }}></div>
                    <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>You're In!</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)', marginBottom: 'var(--space-4)' }}>
                        {session?.quiz_title} — Waiting for the host to start...
                    </p>
                    <div style={{ padding: 'var(--space-3)', background: 'var(--bg-input)', borderRadius: 'var(--radius-lg)' }}>
                        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
                            {participants.length} player{participants.length !== 1 ? 's' : ''} waiting
                        </div>
                        <div className="flex flex-wrap gap-2 justify-center">
                            {participants.map(p => (
                                <span key={p.user_id} className="badge badge-info">{p.display_name || p.matric_no}</span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // QUESTION (student answering)
    if ((phase === 'question' || phase === 'answered') && question) {
        const progress = (countdown / question.duration) * 100;
        const colors = ['var(--error)', 'var(--info)', 'var(--warning)', 'var(--success)'];
        return (
            <div className="page-container">
                <div className="flex items-center justify-between mb-4">
                    <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Question {question.index + 1} / {question.total}
                    </span>
                    <span style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: countdown <= 5 ? 'var(--error)' : 'var(--text-primary)' }}>{countdown}s</span>
                </div>
                <div className="progress-bar mb-6"><div className="progress-bar-fill" style={{ width: `${progress}%`, transition: 'width 1s linear' }}></div></div>

                <div className="card-static mb-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)', textAlign: 'center' }}>
                    <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, lineHeight: 1.6 }}><MathText text={question.question_text} /></h2>
                </div>

                {phase === 'answered' && answerResult ? (
                    <div className="card-static animate-scale-in" style={{
                        textAlign: 'center', padding: 'var(--space-8)', borderRadius: 'var(--radius-xl)',
                        background: answerResult.is_correct ? 'var(--success-soft)' : 'var(--error-soft)',
                        border: `2px solid ${answerResult.is_correct ? 'var(--success)' : 'var(--error)'}`,
                    }}>
                        <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: answerResult.is_correct ? 'var(--success)' : 'var(--error)' }}>
                            {answerResult.is_correct ? 'Correct!' : 'Incorrect'}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)', marginTop: 'var(--space-1)' }}>
                            {answerResult.is_correct ? `+${answerResult.points} points` : `Correct answer: ${answerResult.correct_option?.toUpperCase()}`}
                        </div>
                        <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, marginTop: 'var(--space-4)' }}>
                            Total: {totalScore} pts
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                        {['a', 'b', 'c', 'd'].map((opt, i) => (
                            <button key={opt} onClick={() => submitAnswer(opt)}
                                disabled={!!selectedAnswer}
                                style={{
                                    padding: 'var(--space-5)', borderRadius: 'var(--radius-xl)',
                                    background: selectedAnswer === opt ? 'var(--primary)' : colors[i],
                                    color: 'white', textAlign: 'center', fontSize: 'var(--font-base)', fontWeight: 600,
                                    border: 'none', cursor: selectedAnswer ? 'default' : 'pointer',
                                    opacity: selectedAnswer && selectedAnswer !== opt ? 0.4 : 1,
                                    transition: 'all 0.2s ease',
                                }}>
                                <div style={{ fontSize: 'var(--font-xl)', fontWeight: 700, marginBottom: 'var(--space-1)' }}>{opt.toUpperCase()}</div>
                                <MathText text={question[`option_${opt}`]} />
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // QUESTION RESULTS (student view)
    if (phase === 'results' && questionResults) {
        const myRank = questionResults.leaderboard.findIndex(p => p.user_id === user.id) + 1;
        return (
            <div className="page-container" style={{ textAlign: 'center' }}>
                <div className="card-static animate-scale-in" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)', maxWidth: '500px', margin: '0 auto' }}>
                    <h3 style={{ fontSize: 'var(--font-xl)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>Scoreboard</h3>
                    {myRank > 0 && (
                        <div style={{ padding: 'var(--space-3)', background: 'var(--primary-soft)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-4)' }}>
                            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>You're #{myRank}</span>
                            <span style={{ marginLeft: 'var(--space-2)', color: 'var(--text-secondary)', fontSize: 'var(--font-sm)' }}>{totalScore} pts</span>
                        </div>
                    )}
                    {questionResults.leaderboard.map((p, i) => (
                        <div key={p.user_id} className="flex items-center justify-between" style={{
                            padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)',
                            background: p.user_id === user.id ? 'var(--primary-soft)' : i < 3 ? 'var(--bg-input)' : 'transparent',
                            marginBottom: 'var(--space-1)',
                        }}>
                            <div className="flex items-center gap-2">
                                <span style={{ fontWeight: 700, fontSize: 'var(--font-sm)', width: '24px', color: i === 0 ? 'var(--warning)' : 'var(--text-muted)' }}>#{i + 1}</span>
                                <span style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>{p.display_name || p.matric_no}</span>
                            </div>
                            <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 'var(--font-sm)' }}>{p.total_score}</span>
                        </div>
                    ))}
                    {!questionResults.is_last && <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-xs)', marginTop: 'var(--space-4)' }}>Next question coming up...</p>}
                </div>
            </div>
        );
    }

    // FINAL RESULTS
    if (phase === 'ended') {
        const myRank = finalLeaderboard.findIndex(p => p.user_id === user.id) + 1;
        const podiumLabel = myRank === 1 ? '1st' : myRank === 2 ? '2nd' : myRank === 3 ? '3rd' : `#${myRank}`;
        return (
            <div className="page-container" style={{ textAlign: 'center' }}>
                <div className="card-static animate-scale-in" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-8)', maxWidth: '500px', margin: '0 auto' }}>
                    <h1 style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>Quiz Complete!</h1>
                    <div style={{ fontSize: 'var(--font-4xl)', fontWeight: 700, color: 'var(--primary)', marginBottom: 'var(--space-1)' }}>{totalScore} pts</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)', marginBottom: 'var(--space-6)' }}>You placed {podiumLabel}</div>

                    {finalLeaderboard.map((p, i) => (
                        <div key={p.user_id} className="flex items-center justify-between" style={{
                            padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-lg)',
                            background: p.user_id === user.id ? 'var(--primary-soft)' : i < 3 ? 'var(--bg-input)' : 'transparent',
                            marginBottom: 'var(--space-2)', border: i === 0 ? '2px solid var(--warning)' : 'none',
                        }}>
                            <div className="flex items-center gap-3">
                                <span style={{ fontWeight: 700, fontSize: 'var(--font-sm)', color: i === 0 ? 'var(--warning)' : 'var(--text-muted)', width: '28px' }}>
                                    {i === 0 ? '1st' : i === 1 ? '2nd' : i === 2 ? '3rd' : `#${i + 1}`}
                                </span>
                                <span style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>{p.display_name || p.matric_no}</span>
                            </div>
                            <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{p.total_score}</span>
                        </div>
                    ))}
                    <button className="btn btn-primary mt-6" onClick={() => navigate('/')}>Back to Dashboard</button>
                </div>
            </div>
        );
    }

    return <div className="page-container"><div className="loading-spinner"><div className="spinner"></div></div></div>;
}
