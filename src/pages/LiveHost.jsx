import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import MathText from '../components/MathText';

export default function LiveHost() {
    const { code } = useParams();
    const navigate = useNavigate();
    const { token, user } = useAuth();
    const socketRef = useRef(null);
    const [session, setSession] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [phase, setPhase] = useState('waiting'); // waiting, starting, question, results, ended
    const [question, setQuestion] = useState(null);
    const [answerCount, setAnswerCount] = useState({ answered: 0, total: 0 });
    const [questionResults, setQuestionResults] = useState(null);
    const [finalLeaderboard, setFinalLeaderboard] = useState([]);
    const [countdown, setCountdown] = useState(0);
    const [startingCountdown, setStartingCountdown] = useState(null);

    // Participation states
    const [isParticipating, setIsParticipating] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [answerResult, setAnswerResult] = useState(null);
    const [totalScore, setTotalScore] = useState(0);

    const [copied, setCopied] = useState(false);
    const timerRef = useRef(null);
    const answerStartRef = useRef(null);
    const copiedTimerRef = useRef(null);

    useEffect(() => {
        const socket = io('/', { auth: { token } });
        socketRef.current = socket;

        socket.on('connect', () => {
            socket.emit('join-session', { code: code.toUpperCase() });
        });

        socket.on('joined', ({ session: s }) => { setSession(s); });
        socket.on('participants-update', (p) => setParticipants(p));
        socket.on('quiz-started', () => {
            setPhase('starting');
            setStartingCountdown(5);
            let t = 4;
            const int = setInterval(() => {
                if (t === 0) {
                    clearInterval(int);
                    setStartingCountdown(null);
                } else {
                    setStartingCountdown(t);
                    t--;
                }
            }, 1000);
        });
        socket.on('question', (q) => {
            setQuestion(q);
            setPhase('question');
            setStartingCountdown(null);
            setSelectedAnswer(null);
            setAnswerResult(null);
            setAnswerCount({ answered: 0, total: participants.length });
            setCountdown(q.duration);
            answerStartRef.current = Date.now();
            clearInterval(timerRef.current);
            timerRef.current = setInterval(() => setCountdown(c => {
                if (c <= 1) { clearInterval(timerRef.current); return 0; }
                return c - 1;
            }), 1000);
        });
        socket.on('answer-count', (d) => setAnswerCount(d));
        socket.on('answer-result', (r) => {
            setAnswerResult(r);
            setTotalScore(s => s + r.points);
        });
        socket.on('question-results', (r) => {
            setQuestionResults(r);
            setPhase('results');
            clearInterval(timerRef.current);
            if (!r.is_last) {
                setCountdown(5);
                timerRef.current = setInterval(() => setCountdown(c => {
                    if (c <= 1) { clearInterval(timerRef.current); return 0; }
                    return c - 1;
                }), 1000);
            }
        });
        socket.on('quiz-ended', ({ leaderboard }) => {
            setFinalLeaderboard(leaderboard);
            setPhase('ended');
            clearInterval(timerRef.current);
        });

        return () => { socket.disconnect(); clearInterval(timerRef.current); clearTimeout(copiedTimerRef.current); };
    }, [code, token]);

    function startQuiz() { socketRef.current?.emit('start-quiz'); }
    function nextQuestion() { socketRef.current?.emit('next-question'); }
    function joinAsPlayer() {
        socketRef.current?.emit('join-as-player');
        setIsParticipating(true);
    }

    function markReady() {
        socketRef.current?.emit('player-ready');
        setIsReady(true);
    }

    function markUnready() {
        socketRef.current?.emit('player-unready');
        setIsReady(false);
    }

    function submitAnswer(opt) {
        if (selectedAnswer || !question) return;
        setSelectedAnswer(opt);
        const time_ms = Date.now() - answerStartRef.current;
        socketRef.current?.emit('submit-answer', { question_id: question.question_id, answer: opt, time_ms });
    }

    if (!session) return <div className="page-container"><div className="loading-spinner"><div className="spinner"></div></div></div>;

    // WAITING ROOM
    if (phase === 'waiting') {
        const BUBBLE_COLORS = ['#7c3aed','#3b82f6','#22c55e','#eab308','#ef4444','#ec4899','#06b6d4','#f97316'];
        const readyCount = participants.filter(p => p.is_ready).length;
        const joinLink = `${window.location.origin}/live/play/${code.toUpperCase()}`;

        function copyLink() {
            navigator.clipboard.writeText(joinLink).then(() => {
                setCopied(true);
                clearTimeout(copiedTimerRef.current);
                copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
            }).catch(() => {
                alert('Could not copy — please copy the link manually:\n' + joinLink);
            });
        }

        return (
            <div className="page-container" style={{ textAlign: 'center' }}>
                <div className="card-static animate-scale-in" style={{ maxWidth: '620px', margin: '0 auto', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-8)' }}>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 'var(--space-4)' }}>JOIN CODE</div>
                    <div style={{ fontSize: 'var(--font-4xl)', fontWeight: 700, letterSpacing: '0.15em', color: 'var(--primary)', fontFamily: 'var(--font-mono)', marginBottom: 'var(--space-2)' }}>{code.toUpperCase()}</div>
                    <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>{session.quiz_title}</p>

                    {/* Share link */}
                    <div style={{ marginBottom: 'var(--space-6)' }}>
                        <div style={{
                            fontSize: 'var(--font-xs)', color: 'var(--text-muted)',
                            textTransform: 'uppercase', letterSpacing: '0.08em',
                            marginBottom: 'var(--space-2)',
                        }}>
                            Share with participants
                        </div>
                        <div style={{
                            display: 'flex', alignItems: 'center',
                            background: 'var(--bg-input)',
                            border: `1px solid ${copied ? 'var(--success)' : 'var(--border-color)'}`,
                            borderRadius: 'var(--radius-lg)',
                            overflow: 'hidden',
                            transition: 'border-color 0.2s ease',
                        }}>
                            <span style={{
                                flex: 1,
                                padding: 'var(--space-3) var(--space-4)',
                                fontSize: 'var(--font-xs)',
                                color: 'var(--text-secondary)',
                                fontFamily: 'var(--font-mono)',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                textAlign: 'left',
                            }}>
                                {joinLink}
                            </span>
                            <button
                                onClick={copyLink}
                                style={{
                                    flexShrink: 0,
                                    height: '100%',
                                    padding: 'var(--space-3) var(--space-4)',
                                    background: copied ? 'var(--success)' : 'var(--primary)',
                                    color: 'white',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: 'var(--font-xs)',
                                    fontWeight: 700,
                                    letterSpacing: '0.03em',
                                    transition: 'background 0.2s ease',
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                }}
                            >
                                {copied ? (
                                    <>
                                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                        Copied
                                    </>
                                ) : (
                                    <>
                                        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                                            <rect x="4" y="4" width="8" height="9" rx="1.5" stroke="white" strokeWidth="1.5"/>
                                            <path d="M2 9.5V3a1.5 1.5 0 0 1 1.5-1.5H8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                                        </svg>
                                        Copy Link
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    <div style={{ padding: 'var(--space-6)', background: 'var(--bg-input)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-6)', minHeight: '120px' }}>
                        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {participants.length} Player{participants.length !== 1 ? 's' : ''} Joined
                        </div>
                        {participants.length === 0 ? (
                            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>Waiting for players...</span>
                        ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', justifyContent: 'center' }}>
                                {participants.map((p, idx) => {
                                    const color = BUBBLE_COLORS[p.user_id % BUBBLE_COLORS.length];
                                    const initial = (p.display_name || p.matric_no || '?')[0].toUpperCase();
                                    return (
                                        <div key={p.user_id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', animation: `bubbleFloat ${2.4 + (idx % 4) * 0.4}s ease-in-out infinite`, animationDelay: `${(idx % 6) * 0.35}s` }}>
                                            <div style={{ position: 'relative' }}>
                                                <div style={{
                                                    width: '68px', height: '68px', borderRadius: '50%',
                                                    background: color,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '1.4rem', fontWeight: 700, color: 'white',
                                                    border: p.is_ready ? '2px solid var(--success)' : '2px solid rgba(255,255,255,0.1)',
                                                    boxShadow: p.is_ready ? '0 0 14px rgba(34,197,94,0.35)' : 'none',
                                                    transition: 'all 0.3s ease',
                                                    overflow: 'hidden',
                                                }}>
                                                    {p.profile_pic_url
                                                        ? <img src={p.profile_pic_url} alt={initial} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        : initial}
                                                </div>
                                                {p.is_ready && (
                                                    <div style={{
                                                        position: 'absolute', top: -2, right: -2,
                                                        width: '22px', height: '22px', borderRadius: '50%',
                                                        background: 'var(--success)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        border: '2px solid var(--bg-card)',
                                                    }}>
                                                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                                                            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                                                        </svg>
                                                    </div>
                                                )}
                                            </div>
                                            <span style={{
                                                fontSize: '0.7rem', fontWeight: 600,
                                                color: p.is_ready ? 'var(--text-primary)' : 'var(--text-muted)',
                                                maxWidth: '72px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                            }}>
                                                {p.display_name || p.matric_no}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3 justify-center flex-wrap">
                        {!isParticipating ? (
                            <button className="btn btn-ghost" onClick={joinAsPlayer}>
                                Participate as Player
                            </button>
                        ) : isReady ? (
                            <button className="btn btn-ghost" onClick={markUnready} style={{ color: 'var(--success)', borderColor: 'var(--success)' }}>
                                <svg width="13" height="13" viewBox="0 0 12 12" fill="none" style={{ marginRight: '6px' }}>
                                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                Ready (undo)
                            </button>
                        ) : (
                            <button className="btn btn-ghost" onClick={markReady}>
                                I'm Ready
                            </button>
                        )}
                        <button className="btn btn-primary btn-lg" onClick={startQuiz} disabled={participants.length === 0}>
                            Start Quiz {participants.length > 0 ? `(${readyCount}/${participants.length} Ready)` : ''}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // STARTING COUNTDOWN (host view)
    if (phase === 'starting' && startingCountdown !== null) {
        return (
            <div className="page-container" style={{ textAlign: 'center' }}>
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)'
                }}>
                    <div className="animate-scale-in" key={startingCountdown} style={{
                        fontSize: '120px', fontWeight: 800, color: 'white',
                        textShadow: '0 10px 30px rgba(0,0,0,0.5)', fontFamily: 'var(--font-mono)'
                    }}>
                        {startingCountdown}
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
                    <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 600, lineHeight: 1.6 }}><MathText text={question.question_text} /></h2>
                </div>

                {isParticipating && answerResult ? (
                    <div className="card-static animate-scale-in mb-6" style={{
                        textAlign: 'center', padding: 'var(--space-6)', borderRadius: 'var(--radius-xl)',
                        background: answerResult.is_correct ? 'var(--success-soft)' : 'var(--error-soft)',
                        border: `2px solid ${answerResult.is_correct ? 'var(--success)' : 'var(--error)'}`,
                    }}>
                        <div style={{ fontSize: 'var(--font-xl)', fontWeight: 700, color: answerResult.is_correct ? 'var(--success)' : 'var(--error)' }}>
                            {answerResult.is_correct ? 'Correct!' : 'Incorrect'}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)', marginTop: 'var(--space-1)' }}>
                            {answerResult.is_correct ? `+${answerResult.points} points` : `Correct answer: ${answerResult.correct_option?.toUpperCase()}`}
                        </div>
                        <div style={{ fontSize: 'var(--font-base)', fontWeight: 700, marginTop: 'var(--space-2)' }}>
                            Your Total: {totalScore} pts
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                        {['a', 'b', 'c', 'd'].map((opt, i) => (
                            <button key={opt}
                                onClick={() => isParticipating && submitAnswer(opt)}
                                disabled={isParticipating && !!selectedAnswer}
                                style={{
                                    padding: 'var(--space-5)', borderRadius: 'var(--radius-xl)',
                                    background: (isParticipating && selectedAnswer === opt) ? 'var(--primary)' : ['var(--error)', 'var(--info)', 'var(--warning)', 'var(--success)'][i],
                                    color: 'white', textAlign: 'center', fontSize: 'var(--font-base)', fontWeight: 600,
                                    border: 'none',
                                    cursor: !isParticipating ? 'default' : selectedAnswer ? 'default' : 'pointer',
                                    opacity: (isParticipating && selectedAnswer && selectedAnswer !== opt) ? 0.4 : 1,
                                    transition: 'all 0.2s ease',
                                }}>
                                <div style={{ fontSize: 'var(--font-xl)', fontWeight: 700, marginBottom: 'var(--space-1)' }}>{opt.toUpperCase()}</div>
                                <MathText text={question[`option_${opt}`]} />
                            </button>
                        ))}
                    </div>
                )}

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
                        <div key={p.user_id} className="flex items-center justify-between" style={{
                            padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)',
                            background: p.user_id === user.id ? 'var(--primary-soft)' : i < 3 ? 'var(--bg-input)' : 'transparent',
                            marginBottom: 'var(--space-1)',
                            border: p.user_id === user.id ? '1px solid var(--primary)' : 'none'
                        }}>
                            <div className="flex items-center gap-3">
                                <span style={{ fontWeight: 700, fontSize: 'var(--font-sm)', color: i === 0 ? 'var(--warning)' : 'var(--text-muted)', width: '24px' }}>#{i + 1}</span>
                                <span style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>{p.display_name} {p.user_id === user.id && '(You)'}</span>
                            </div>
                            <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 'var(--font-sm)' }}>{p.total_score}</span>
                        </div>
                    ))}
                </div>

                {!questionResults.is_last && (
                    <div className="flex justify-center mt-6">
                        <button className="btn btn-primary btn-lg" onClick={nextQuestion}>
                            Next Question {countdown > 0 && `(${countdown}s)`}
                        </button>
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
                            background: p.user_id === user.id ? 'var(--primary-soft)' : i < 3 ? 'var(--bg-input)' : 'transparent',
                            marginBottom: 'var(--space-2)',
                            border: p.user_id === user.id ? '2px solid var(--primary)' : i === 0 ? '2px solid var(--warning)' : 'none',
                        }}>
                            <div className="flex items-center gap-3">
                                <span style={{ fontWeight: 700, fontSize: 'var(--font-sm)', color: i === 0 ? 'var(--warning)' : i < 3 ? 'var(--text-secondary)' : 'var(--text-muted)', width: '24px' }}>
                                    {i === 0 ? '1st' : i === 1 ? '2nd' : i === 2 ? '3rd' : `#${i + 1}`}
                                </span>
                                <span style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>{p.display_name} {p.user_id === user.id && '(You)'}</span>
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
