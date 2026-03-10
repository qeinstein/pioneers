import { Link } from 'react-router-dom';

export default function QuizCard({ quiz, showCourse = true }) {
    const difficulty = quiz.difficulty || 'Medium';
    const diffClass = difficulty === 'Easy' ? 'difficulty-easy' : difficulty === 'Hard' ? 'difficulty-hard' : 'difficulty-medium';

    return (
        <Link to={`/quiz/${quiz.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div className="flex items-center justify-between mb-2">
                    {showCourse && <span className="badge badge-primary">{quiz.course_code}</span>}
                    <span className={`badge ${diffClass}`}>{difficulty}</span>
                </div>

                <h3 style={{ fontSize: 'var(--font-base)', fontWeight: 700, marginBottom: 'var(--space-2)', letterSpacing: '-0.01em' }}>
                    {quiz.title}
                </h3>

                {quiz.description && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)', marginBottom: 'var(--space-3)', flex: 1, lineHeight: 1.5 }}>
                        {quiz.description.length > 100 ? quiz.description.slice(0, 100) + '...' : quiz.description}
                    </p>
                )}

                <div className="flex flex-wrap gap-1" style={{ marginBottom: 'var(--space-3)' }}>
                    {(quiz.tags || []).slice(0, 3).map(tag => (
                        <span key={tag} className="tag" style={{ cursor: 'default' }}>#{tag}</span>
                    ))}
                </div>

                <div className="flex items-center justify-between" style={{ marginTop: 'auto' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-xs)' }}>
                        {quiz.question_count || '?'} questions
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-xs)' }}>
                        {quiz.times_taken} taken
                    </span>
                </div>

                {quiz.avg_score !== null && quiz.avg_score !== undefined && (
                    <div style={{ marginTop: 'var(--space-2)' }}>
                        <div className="progress-bar">
                            <div className="progress-bar-fill" style={{ width: `${Math.round(quiz.avg_score)}%` }}></div>
                        </div>
                        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                            Avg: {Math.round(quiz.avg_score)}%
                        </span>
                    </div>
                )}
            </div>
        </Link>
    );
}
