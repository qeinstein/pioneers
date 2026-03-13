import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function ProfilePopup({ userId, onClose }) {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;
        setLoading(true);
        fetch(`/api/auth/profile/${userId}`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then(data => {
                setProfile(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [userId, token]);

    if (!userId) return null;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)'
        }} onClick={onClose}>
            <div
                className="card-static animate-scale-in"
                style={{
                    background: 'var(--bg-card-solid)', border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)',
                    width: '90%', maxWidth: '400px', position: 'relative',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
                }}
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute', top: '16px', right: '16px',
                        background: 'var(--bg-card-hover)', border: 'none',
                        width: '32px', height: '32px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: 'var(--text-secondary)'
                    }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>

                {loading ? (
                    <div className="loading-spinner" style={{ minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div className="spinner"></div>
                    </div>
                ) : !profile ? (
                    <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--text-muted)' }}>
                        User not found.
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4 text-center">
                        <div className="avatar" style={{ width: '100px', height: '100px', fontSize: 'var(--font-2xl)', border: '4px solid var(--bg-primary)' }}>
                            {profile.profile_pic_url ? <img src={profile.profile_pic_url} alt="" /> : (profile.display_name || profile.matric_no).slice(0, 2).toUpperCase()}
                        </div>

                        <div>
                            <div style={{ fontSize: 'var(--font-xl)', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {profile.display_name || profile.matric_no}
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-base)', marginTop: 'var(--space-1)' }}>
                                {profile.matric_no}
                            </div>
                        </div>

                        {profile.role === 'admin' && (
                            <div className="badge badge-primary">Admin</div>
                        )}

                        {profile.bio && (
                            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)', fontStyle: 'italic', background: 'var(--bg-primary)', padding: 'var(--space-3)', borderRadius: 'var(--radius-lg)', width: '100%' }}>
                                "{profile.bio}"
                            </p>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', width: '100%', marginTop: 'var(--space-2)' }}>
                            <div style={{ background: 'var(--bg-primary)', padding: 'var(--space-3)', borderRadius: 'var(--radius-lg)' }}>
                                <div style={{ fontSize: 'var(--font-xl)', fontWeight: 600, color: 'var(--primary)' }}>{profile.stats?.quizzes_taken || 0}</div>
                                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quizzes</div>
                            </div>
                            <div style={{ background: 'var(--bg-primary)', padding: 'var(--space-3)', borderRadius: 'var(--radius-lg)' }}>
                                <div style={{ fontSize: 'var(--font-xl)', fontWeight: 600, color: 'var(--warning)' }}>{profile.stats?.avg_score || 0}%</div>
                                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg Score</div>
                            </div>
                        </div>

                        <button
                            className="btn btn-primary"
                            style={{ width: '100%', marginTop: 'var(--space-2)' }}
                            onClick={() => {
                                onClose();
                                navigate(`/profile/${profile.id}`);
                            }}
                        >
                            View Full Profile
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
