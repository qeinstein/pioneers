import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

export default function LiveHost() {
    const { code } = useParams();
    const navigate = useNavigate();
    const { token, user } = useAuth();
    const socketRef = useRef(null);
    const [session, setSession] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [phase, setPhase] = useState('waiting'); // waiting, question, results, ended
    const [question, setQuestion] = useState(null);
    const [answerCount, setAnswerCount] = useState({ answered: 0, total: 0 });
    const [questionResults, setQuestionResults] = useState(null);
    const [finalLeaderboard, setFinalLeaderboard] = useState([]);
    const [countdown, setCountdown] = useState(0);
    const timerRef = useRef(null);

    useEffect(() => {
        const socket = io('/', { auth: { token } });
        socketRef.current = socket;

        socket.on('connect', () => {
            socket.emit('join-session', { code: code.toUpperCase() });
        });

        socket.on('joined', ({ session: s }) => { setSession(s); });
        socket.on('participants-update', (p) => setParticipants(p));
        socket.on('quiz-started', () => setPhase('question'));
        socket.on('question', (q) => {
            setQuestion(q);
            setPhase('question');
            setAnswerCount({ answered: 0, total: participants.length });
            setCountdown(q.duration);
            clearInterval(timerRef.current);
            timerRef.current = setInterval(() => setCountdown(c => {
                if (c <= 1) { clearInterval(timerRef.current); return 0; }
                return c - 1;
            }), 1000);
        });
        socket.on('answer-count', (d) => setAnswerCount(d));
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

        return () => { socket.disconnect(); clearInterval(timerRef.current); };
    }, [code, token]);

    function startQuiz() { socketRef.current?.emit('start-quiz'); }
    function nextQuestion() { socketRef.current?.emit('next-question'); }

    if (!session) return <div className="page-container"><div className="loading-spinner"><div className="spinner"></div></div></div>;

    // WAITING ROOM
    if (phase === 'waiting') {
        return (
            <div className="page-container" style={{ textAlign: 'center' }}>
                <div className="card-static animate-scale-in" style={{ maxWidth: '500px', margin: '0 auto', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-8)' }}>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 'var(--space-4)' }}>JOIN CODE</div>
                    <div style={{ fontSize: 'var(--font-4xl)', fontWeight: 700, letterSpacing: '0.15em', color: 'var(--primary)', fontFamily: 'var(--font-mono)', marginBottom: 'var(--space-2)' }}>{code.toUpperCase()}</div>
                    <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>{session.quiz_title}</p>

                    <div style={{ padding: 'var(--space-4)', background: 'var(--bg-input)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-6)' }}>
                        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {participants.length} Player{participants.length !== 1 ? 's' : ''} Joined
                        </div>
                        <div className="flex flex-wrap gap-2 justify-center">
                            {participants.map(p => (
                                <div key={p.user_id} className="badge badge-info">{p.display_name}</div>
                            ))}
                            {participants.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>Waiting for players...</span>}
                        </div>
                    </div>

                    <div className="flex gap-3 justify-center">
                        <button className="btn btn-ghost" onClick={() => window.open(`/live/join/${code.toUpperCase()}`, '_blank')}>
                            Join as Player
                        </button>
                        <button className="btn btn-primary btn-lg" onClick={startQuiz} disabled={participants.length === 0}>
                            Start Quiz ({session.question_count} questions)
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ACTIVE QUESTION
    if (phase === 'question' && question) {
        const progress = (countdown / question.duration) * 100;
        return (
            <div className="page-container">
                <div className="card-static mb-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-4)' }}>
                    <div className="flex items-center justify-between mb-2">
                        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Question {question.index + 1} / {question.total}</span>
                        <span style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: countdown <= 5 ? 'var(--error)' : 'var(--text-primary)' }}>{countdown}s</span>
                    </div>
                    <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${progress}%`, transition: 'width 1s linear' }}></div></div>
                </div>

                <div className="card-static mb-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)', textAlign: 'center' }}>
                    <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 600, lineHeight: 1.6 }}>{question.question_text}</h2>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    {['a', 'b', 'c', 'd'].map((opt, i) => (
                        <div key={opt} style={{
                            padding: 'var(--space-5)', borderRadius: 'var(--radius-xl)',
                            background: ['var(--error)', 'var(--info)', 'var(--warning)', 'var(--success)'][i],
                            color: 'white', textAlign: 'center', fontSize: 'var(--font-base)', fontWeight: 600,
                        }}>
                            <div style={{ fontSize: 'var(--font-xl)', fontWeight: 700, marginBottom: 'var(--space-1)' }}>{opt.toUpperCase()}</div>
                            {question[`option_${opt}`]}
                        </div>
                    ))}
                </div>

                <div className="flex items-center justify-center mt-6 gap-4">
                    <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)' }}>
                        {answerCount.answered} / {answerCount.total || participants.length} answered
                    </span>
                </div>
            </div>
        );
    }

    // QUESTION RESULTS
    if (phase === 'results' && questionResults) {
        const total = Object.values(questionResults.distribution).reduce((a, b) => a + b, 0) || 1;
        return (
            <div className="page-container">
                <div className="card-static mb-6 animate-scale-in" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)' }}>
                    <h3 style={{ fontSize: 'var(--font-base)', fontWeight: 700, marginBottom: 'var(--space-4)', textAlign: 'center' }}>Answer Distribution</h3>
                    <div className="flex flex-col gap-3">
                        {['a', 'b', 'c', 'd'].map((opt, i) => {
                            const count = questionResults.distribution[opt] || 0;
                            const pct = Math.round((count / total) * 100);
                            const isCorrect = opt === questionResults.correct_option;
                            return (
                                <div key={opt} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                    <div style={{
                                        width: '32px', height: '32px', borderRadius: 'var(--radius-md)',
                                        background: isCorrect ? 'var(--success)' : 'var(--bg-input)',
                                        color: isCorrect ? 'white' : 'var(--text-secondary)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontWeight: 700, fontSize: 'var(--font-sm)', flexShrink: 0,
                                    }}>{opt.toUpperCase()}</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ height: '28px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', overflow: 'hidden' }}>
                                            <div style={{
                                                height: '100%', borderRadius: 'var(--radius-md)',
                                                background: isCorrect ? 'var(--success)' : ['var(--error)', 'var(--info)', 'var(--warning)', 'var(--success)'][i],
                                                width: `${pct}%`, transition: 'width 0.8s ease',
                                                display: 'flex', alignItems: 'center', paddingLeft: 'var(--space-2)',
                                                fontSize: 'var(--font-xs)', fontWeight: 600, color: 'white',
                                            }}>{count > 0 ? `${count} (${pct}%)` : ''}</div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="card-static animate-slide-up" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)' }}>
                    <h3 style={{ fontSize: 'var(--font-base)', fontWeight: 700, marginBottom: 'var(--space-4)', textAlign: 'center' }}>Leaderboard</h3>
                    {questionResults.leaderboard.map((p, i) => (
                        <div key={p.user_id} className="flex items-center justify-between" style={{ padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', background: i < 3 ? 'var(--bg-input)' : 'transparent', marginBottom: 'var(--space-1)' }}>
                            <div className="flex items-center gap-3">
                                <span style={{ fontWeight: 700, fontSize: 'var(--font-sm)', color: i === 0 ? 'var(--warning)' : 'var(--text-muted)', width: '24px' }}>#{i + 1}</span>
                                <span style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>{p.display_name}</span>
                            </div>
                            <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 'var(--font-sm)' }}>{p.total_score}</span>
                        </div>
                    ))}
                </div>

                {!questionResults.is_last && (
                    <div className="flex justify-center mt-6">
                        <button className="btn btn-primary btn-lg" onClick={nextQuestion}>Next Question</button>
                    </div>
                )}
            </div>
        );
    }

    // FINAL RESULTS
    if (phase === 'ended') {
        return (
            <div className="page-container" style={{ textAlign: 'center' }}>
                <div className="card-static animate-scale-in" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-8)', maxWidth: '600px', margin: '0 auto' }}>
                    <h1 style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, marginBottom: 'var(--space-6)' }}>Final Results</h1>
                    {finalLeaderboard.map((p, i) => (
                        <div key={p.user_id} className="flex items-center justify-between" style={{
                            padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-lg)',
                            background: i < 3 ? 'var(--bg-input)' : 'transparent', marginBottom: 'var(--space-2)',
                            border: i === 0 ? '2px solid var(--warning)' : 'none',
                        }}>
                            <div className="flex items-center gap-3">
                                <span style={{ fontWeight: 700, fontSize: 'var(--font-sm)', color: i === 0 ? 'var(--warning)' : i < 3 ? 'var(--text-secondary)' : 'var(--text-muted)', width: '24px' }}>
                                    {i === 0 ? '1st' : i === 1 ? '2nd' : i === 2 ? '3rd' : `#${i + 1}`}
                                </span>
                                <span style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>{p.display_name}</span>
                            </div>
                            <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{p.total_score} pts</span>
                        </div>
                    ))}
                    <button className="btn btn-primary mt-6" onClick={() => navigate('/')}>Back to Dashboard</button>
                </div>
            </div>
        );
    }

    return <div className="page-container"><div className="loading-spinner"><div className="spinner"></div></div></div>;
}
