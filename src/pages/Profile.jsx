import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const BADGE_INFO = {
    first_quiz: { label: 'First Quiz' },
    ten_quizzes: { label: '10 Quizzes' },
    fifty_quizzes: { label: '50 Quizzes' },
    perfect_score: { label: 'Perfect Score' },
    quiz_creator: { label: 'Quiz Creator' },
    streak_3: { label: '3-Day Streak' },
    streak_7: { label: '7-Day Streak' },
};

export default function Profile() {
    const { userId } = useParams();
    const { user: currentUser, token } = useAuth();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const isOwnProfile = !userId || parseInt(userId) === currentUser?.id;

    useEffect(() => {
        const url = isOwnProfile ? '/api/auth/profile' : `/api/auth/profile/${userId}`;
        fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(setProfile).finally(() => setLoading(false));
    }, [userId]);

    if (loading) return <div className="page-container"><div className="loading-spinner"><div className="spinner"></div></div></div>;
    if (!profile) return <div className="page-container"><div className="empty-state"><div className="empty-state-title">User not found</div></div></div>;

    return (
        <div className="page-container">
            <div className="card-static animate-scale-in" style={{
                textAlign: 'center', marginBottom: 'var(--space-8)', padding: 'var(--space-8)',
                background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)',
            }}>
                <div className="avatar avatar-xl" style={{ margin: '0 auto var(--space-4)' }}>
                    {profile.profile_pic_url ? <img src={profile.profile_pic_url} alt="" /> : (profile.display_name || profile.matric_no).slice(0, 2).toUpperCase()}
                </div>
                <h1 style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, letterSpacing: '-0.03em' }}>{profile.display_name || profile.matric_no}</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>{profile.matric_no}</p>
                {profile.bio && <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-2)', maxWidth: '500px', margin: 'var(--space-2) auto 0', fontSize: 'var(--font-sm)' }}>{profile.bio}</p>}
                {profile.role === 'admin' && <span className="badge badge-warning mt-2">Admin</span>}
                {profile.streak && profile.streak.current_streak > 0 && (
                    <div className="mt-4" style={{ display: 'flex', justifyContent: 'center' }}>
                        <div className="streak-display">
                            <video src="/streak-fire.webm" autoPlay loop muted playsInline style={{ width: '64px', height: '64px', objectFit: 'cover', filter: 'drop-shadow(0 0 10px rgba(255,120,0,0.9))' }} />
                            <span className="streak-number">{profile.streak.current_streak}</span>
                            <span className="streak-label">day streak!</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-xs)', marginLeft: 'var(--space-2)' }}>(Best: {profile.streak.longest_streak})</span>
                        </div>
                    </div>
                )}
                {isOwnProfile && <Link to="/settings" className="btn btn-ghost btn-sm mt-4">Edit Profile</Link>}
            </div>

            <div className="stats-grid mb-8 stagger-children">
                <div className="stat-card"><div className="stat-value">{profile.stats?.quizzes_taken || 0}</div><div className="stat-label">Quizzes Taken</div></div>
                <div className="stat-card"><div className="stat-value">{profile.stats?.avg_score || 0}%</div><div className="stat-label">Average Score</div></div>
                <div className="stat-card"><div className="stat-value">{profile.stats?.quizzes_created || 0}</div><div className="stat-label">Created</div></div>
                <div className="stat-card"><div className="stat-value">{profile.streak?.longest_streak || 0}</div><div className="stat-label">Longest Streak</div></div>
            </div>

            <div className="card-static mb-8" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)' }}>
                <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-4)', fontSize: 'var(--font-base)' }}>Achievements</h3>
                {profile.achievements && profile.achievements.length > 0 ? (
                    <div className="flex flex-wrap gap-3">
                        {profile.achievements.map(a => {
                            const info = BADGE_INFO[a.badge_type] || { label: a.badge_type };
                            return <div key={a.badge_type} className="achievement-badge"><span>{info.label}</span></div>;
                        })}
                    </div>
                ) : <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>No achievements yet. Start quizzing!</p>}
            </div>

            {profile.recent_attempts && profile.recent_attempts.length > 0 && (
                <div className="card-static" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)' }}>
                    <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-4)', fontSize: 'var(--font-base)' }}>Recent Activity</h3>
                    <div className="flex flex-col gap-3">
                        {profile.recent_attempts.map((a, i) => (
                            <div key={i} className="flex items-center justify-between" style={{ padding: 'var(--space-3)', background: 'var(--bg-input)', borderRadius: 'var(--radius-lg)' }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>{a.quiz_title}</div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-xs)' }}>{a.course_code}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 700, fontSize: 'var(--font-sm)', color: (a.score / a.total_questions * 100) >= 80 ? 'var(--success)' : (a.score / a.total_questions * 100) >= 50 ? 'var(--warning)' : 'var(--error)' }}>{Math.round(a.score / a.total_questions * 100)}%</div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-xs)' }}>{new Date(a.created_at).toLocaleDateString()}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
