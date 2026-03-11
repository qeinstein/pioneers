import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CommentSection from '../components/CommentSection';
import MathText from '../components/MathText';

export default function QuizPage() {
    const { id } = useParams();
    const { token, isAdmin } = useAuth();
    const navigate = useNavigate();
    const [quiz, setQuiz] = useState(null);
    const [answers, setAnswers] = useState({});
    const [currentQ, setCurrentQ] = useState(0);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [started, setStarted] = useState(false);
    const [timeElapsed, setTimeElapsed] = useState(0);
    const [bookmarked, setBookmarked] = useState(false);
    const timerRef = useRef(null);

    useEffect(() => {
        fetch(`/api/quizzes/${id}`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then(data => { setQuiz(data); setBookmarked(data.is_bookmarked); })
            .finally(() => setLoading(false));
    }, [id]);

    useEffect(() => {
        if (started) { timerRef.current = setInterval(() => setTimeElapsed(t => t + 1), 1000); }
        return () => clearInterval(timerRef.current);
    }, [started]);

    function selectAnswer(questionId, option) { setAnswers(prev => ({ ...prev, [questionId]: option })); }

    async function handleSubmit() {
        clearInterval(timerRef.current);
        setSubmitting(true);
        try {
            const res = await fetch(`/api/quizzes/${id}/attempt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ answers, time_spent: timeElapsed }),
            });
            const data = await res.json();
            sessionStorage.setItem(`quiz_results_${id}`, JSON.stringify(data));
            navigate(`/results/${id}`);
        } catch { alert('Failed to submit quiz'); }
        finally { setSubmitting(false); }
    }

    async function toggleBookmark() {
        const method = bookmarked ? 'DELETE' : 'POST';
        await fetch(`/api/bookmarks/${id}`, { method, headers: { Authorization: `Bearer ${token}` } });
        setBookmarked(!bookmarked);
    }

    async function startLive() {
        try {
            const res = await fetch('/api/live/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ quiz_id: parseInt(id), question_duration: 20 }),
            });
            const data = await res.json();
            if (res.ok) navigate(`/live/host/${data.session_code}`);
        } catch { }
    }

    if (loading) return <div className="page-container"><div className="loading-spinner"><div className="spinner"></div></div></div>;
    if (!quiz) return <div className="page-container"><div className="empty-state"><div className="empty-state-title">Quiz not found</div></div></div>;

    const questions = quiz.questions || [];
    const progress = Object.keys(answers).length / questions.length * 100;
    const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    if (!started) {
        const diffClass = quiz.difficulty === 'Easy' ? 'difficulty-easy' : quiz.difficulty === 'Hard' ? 'difficulty-hard' : 'difficulty-medium';
        return (
            <div className="page-container">
                <div className="card-static animate-scale-in" style={{
                    maxWidth: '600px', margin: '0 auto', textAlign: 'center',
                    background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-8)',
                }}>
                    <span className="badge badge-primary">{quiz.course_code}</span>
                    <h1 style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, marginTop: 'var(--space-4)', letterSpacing: '-0.03em' }}>{quiz.title}</h1>
                    {quiz.description && <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-2)', fontSize: 'var(--font-sm)' }}>{quiz.description}</p>}

                    <div className="flex items-center justify-center gap-4 mt-6" style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)' }}>
                        <span>{questions.length} questions</span>
                        <span>{quiz.times_taken} taken</span>
                        <span className={`badge ${diffClass}`}>{quiz.difficulty}</span>
                    </div>

                    <div className="flex flex-wrap gap-2 justify-center mt-4">
                        {(quiz.tags || []).map(t => <span key={t} className="tag">#{t}</span>)}
                    </div>

                    {quiz.my_attempts && quiz.my_attempts.length > 0 && (
                        <div style={{ marginTop: 'var(--space-6)', padding: 'var(--space-4)', background: 'var(--bg-input)', borderRadius: 'var(--radius-lg)' }}>
                            <h4 style={{ fontSize: 'var(--font-xs)', fontWeight: 600, marginBottom: 'var(--space-2)', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Previous Attempts</h4>
                            {quiz.my_attempts.slice(0, 3).map((a, i) => (
                                <div key={i} className="flex items-center justify-between" style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', padding: 'var(--space-1) 0' }}>
                                    <span>{Math.round(a.score / a.total_questions * 100)}% ({a.score}/{a.total_questions})</span>
                                    <span>{formatTime(a.time_spent)}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex gap-3 justify-center mt-8 flex-wrap">
                        <button onClick={() => navigate(-1)} className="btn btn-ghost">Back</button>
                        <button onClick={toggleBookmark} className="btn btn-ghost">{bookmarked ? 'Saved' : 'Save'}</button>
                        <button onClick={startLive} className="btn btn-ghost">Start Live</button>
                        <button onClick={() => setStarted(true)} className="btn btn-primary btn-lg">Solo Practice</button>
                    </div>
                </div>

                <CommentSection quizId={id} />
            </div>
        );
    }

    const question = questions[currentQ];

    return (
        <div className="page-container">
            <div className="card-static mb-4 animate-fade-in" style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-4)',
            }}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <h2 style={{ fontSize: 'var(--font-base)', fontWeight: 700 }}>{quiz.title}</h2>
                    <div className="flex items-center gap-4">
                        <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{formatTime(timeElapsed)}</span>
                        <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>{Object.keys(answers).length}/{questions.length}</span>
                    </div>
                </div>
                <div className="progress-bar mt-2"><div className="progress-bar-fill" style={{ width: `${progress}%` }}></div></div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4 justify-center">
                {questions.map((q, i) => (
                    <button key={q.id} onClick={() => setCurrentQ(i)} style={{
                        width: '32px', height: '32px', borderRadius: 'var(--radius-md)',
                        border: i === currentQ ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        background: answers[q.id] ? 'var(--primary)' : 'var(--bg-input)',
                        color: answers[q.id] ? 'white' : 'var(--text-secondary)',
                        fontSize: 'var(--font-xs)', fontWeight: 600, cursor: 'pointer',
                        transition: 'all var(--transition-fast)', fontFamily: 'var(--font-family)',
                    }}>{i + 1}</button>
                ))}
            </div>

            <div className="card-static animate-fade-in" key={currentQ} style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)',
            }}>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Question {currentQ + 1} of {questions.length}
                </div>
                <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, marginBottom: 'var(--space-6)', lineHeight: 1.6 }}>
                    <MathText text={question.question_text} />
                </h3>

                {['a', 'b', 'c', 'd'].map(opt => (
                    <div key={opt}
                        className={`quiz-option ${answers[question.id] === opt ? 'selected' : ''}`}
                        onClick={() => selectAnswer(question.id, opt)}
                    >
                        <div className="quiz-option-label">{opt.toUpperCase()}</div>
                        <span style={{ flex: 1 }}><MathText text={question[`option_${opt}`]} /></span>
                    </div>
                ))}
            </div>

            <div className="flex items-center justify-between mt-6">
                <button className="btn btn-ghost" disabled={currentQ === 0} onClick={() => setCurrentQ(currentQ - 1)}>Previous</button>
                <div className="flex gap-3">
                    {currentQ < questions.length - 1 ? (
                        <button className="btn btn-primary" onClick={() => setCurrentQ(currentQ + 1)}>Next</button>
                    ) : (
                        <button className="btn btn-success btn-lg" onClick={handleSubmit}
                            disabled={submitting || Object.keys(answers).length === 0}>
                            {submitting ? 'Submitting...' : `Submit (${Object.keys(answers).length}/${questions.length})`}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
