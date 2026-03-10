import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';

export default function Results() {
    const { quizId } = useParams();
    const navigate = useNavigate();
    const [results, setResults] = useState(null);

    useEffect(() => {
        const stored = sessionStorage.getItem(`quiz_results_${quizId}`);
        if (stored) setResults(JSON.parse(stored));
        else navigate('/quiz-bank');
    }, [quizId]);

    if (!results) return <div className="page-container"><div className="loading-spinner"><div className="spinner"></div></div></div>;

    const { score, total, percentage, time_spent, results: questions } = results;
    const formatTime = (s) => `${Math.floor(s / 60)}m ${s % 60}s`;
    const scoreColor = percentage >= 80 ? 'var(--success)' : percentage >= 50 ? 'var(--warning)' : 'var(--error)';
    const scoreMessage = percentage >= 80 ? 'Excellent work' : percentage >= 50 ? 'Good effort' : 'Keep practicing';

    return (
        <div className="page-container">
            <div className="card-static animate-scale-in" style={{
                textAlign: 'center', marginBottom: 'var(--space-8)', padding: 'var(--space-8)',
                background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)',
            }}>
                <div style={{ fontSize: 'var(--font-4xl)', fontWeight: 700, color: scoreColor, letterSpacing: '-0.05em' }}>{percentage}%</div>
                <div style={{ fontSize: 'var(--font-lg)', fontWeight: 600, marginTop: 'var(--space-2)' }}>{scoreMessage}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)', marginTop: 'var(--space-1)' }}>
                    {score}/{total} correct &middot; {formatTime(time_spent)}
                </div>
                <div className="flex gap-3 justify-center mt-6">
                    <Link to={`/quiz/${quizId}`} className="btn btn-primary">Retake</Link>
                    <Link to="/quiz-bank" className="btn btn-ghost">Quiz Bank</Link>
                    <Link to="/leaderboard" className="btn btn-ghost">Leaderboard</Link>
                </div>
            </div>

            <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 700, marginBottom: 'var(--space-4)', letterSpacing: '-0.02em' }}>Question Breakdown</h2>

            <div className="stagger-children flex flex-col gap-4">
                {questions.map((q, i) => (
                    <div key={q.question_id} className="card-static" style={{
                        background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)',
                    }}>
                        <div className="flex items-center gap-3 mb-4">
                            <span style={{
                                width: '28px', height: '28px', borderRadius: 'var(--radius-full)',
                                background: q.is_correct ? 'var(--success)' : 'var(--error)',
                                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 700, fontSize: 'var(--font-xs)', flexShrink: 0,
                            }}>
                                {q.is_correct ? '✓' : '✗'}
                            </span>
                            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Question {i + 1}</span>
                            <span className={`badge ${q.is_correct ? 'badge-success' : 'badge-error'}`}>{q.is_correct ? 'Correct' : 'Incorrect'}</span>
                        </div>

                        <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-4)', lineHeight: 1.6 }}>{q.question_text}</h4>

                        {['a', 'b', 'c', 'd'].map(opt => {
                            const isCorrect = q.correct_option === opt;
                            const isSelected = q.user_answer === opt;
                            let className = 'quiz-option';
                            if (isCorrect) className += ' correct';
                            else if (isSelected && !isCorrect) className += ' incorrect';
                            return (
                                <div key={opt} className={className} style={{ cursor: 'default' }}>
                                    <div className="quiz-option-label">{opt.toUpperCase()}</div>
                                    <span style={{ flex: 1 }}>{q[`option_${opt}`]}</span>
                                </div>
                            );
                        })}

                        {q.explanation && (
                            <div style={{
                                marginTop: 'var(--space-4)', padding: 'var(--space-4)',
                                background: 'var(--info-soft)', borderRadius: 'var(--radius-lg)',
                                borderLeft: '3px solid var(--info)',
                            }}>
                                <div style={{ fontWeight: 600, fontSize: 'var(--font-xs)', color: 'var(--info)', marginBottom: 'var(--space-1)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Explanation</div>
                                <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{q.explanation}</p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
