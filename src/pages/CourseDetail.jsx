import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import QuizCard from '../components/QuizCard';
import LeaderboardTable from '../components/LeaderboardTable';
import MathText from '../components/MathText';

export default function CourseDetail() {
    const { id } = useParams();
    const { token, user } = useAuth();
    const [course, setCourse] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch(`/api/courses/${id}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
            fetch(`/api/leaderboard/course/${id}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        ]).then(([c, l]) => {
            setCourse(c);
            setLeaderboard(l);
        }).finally(() => setLoading(false));
    }, [id]);

    if (loading) return <div className="page-container"><div className="loading-spinner"><div className="spinner"></div></div></div>;
    if (!course) return <div className="page-container"><div className="empty-state"><div className="empty-state-title">Course not found</div></div></div>;

    return (
        <div className="page-container">
            <Link to="/" className="back-link">Back to Dashboard</Link>

            <div className="card-static animate-slide-up" style={{
                marginBottom: 'var(--space-8)', padding: 'var(--space-6)',
                background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)',
            }}>
                <span className="badge badge-primary mb-2">{course.course_code}</span>
                <h1 style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, marginTop: 'var(--space-2)', letterSpacing: '-0.03em' }}>
                    {course.course_name}
                </h1>
                {course.description && (
                    <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-2)', maxWidth: '600px', fontSize: 'var(--font-sm)' }}>
                        <MathText text={course.description} />
                    </p>
                )}
                <div className="flex items-center gap-4 mt-4" style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                    <span>{course.quizzes?.length || 0} quizzes</span>
                    {course.creator_name && <span>By {course.creator_name}</span>}
                </div>
            </div>

            <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 700, marginBottom: 'var(--space-4)', letterSpacing: '-0.02em' }}>Quizzes</h2>
            {course.quizzes && course.quizzes.length > 0 ? (
                <div className="grid-2 stagger-children" style={{ marginBottom: 'var(--space-8)' }}>
                    {course.quizzes.map(q => <QuizCard key={q.id} quiz={{ ...q, tags: JSON.parse(q.tags || '[]') }} showCourse={false} />)}
                </div>
            ) : (
                <div className="empty-state mb-6">
                    <div className="empty-state-title">No quizzes in this course yet</div>
                    <Link to="/create-quiz" className="btn btn-primary mt-4">Create One</Link>
                </div>
            )}

            <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 700, marginBottom: 'var(--space-4)', letterSpacing: '-0.02em' }}>Course Leaderboard</h2>
            <LeaderboardTable data={leaderboard.slice(0, 10)} currentUserId={user?.id} />
        </div>
    );
}
