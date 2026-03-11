import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function SetUsername() {
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { token, refreshProfile } = useAuth();
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');

        if (!username || username.trim().length < 3) {
            setError('Username must be at least 3 characters long.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/auth/username', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ username })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to set username');

            await refreshProfile();
            navigate('/');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-primary)', padding: 'var(--space-4)'
        }}>
            <div className="card-static animate-slide-up" style={{
                maxWidth: '400px', width: '100%', background: 'var(--bg-card-solid)',
                border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)',
                padding: 'var(--space-6)', boxShadow: 'var(--glass-shadow)', position: 'relative', overflow: 'hidden'
            }}>
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: '4px',
                    background: 'linear-gradient(90deg, var(--primary), var(--secondary))'
                }}></div>

                <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
                    <div style={{
                        width: '64px', height: '64px', margin: '0 auto var(--space-4)',
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(168,85,247,0.1))',
                        borderRadius: 'var(--radius-xl)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--primary)', border: '1px solid rgba(99,102,241,0.2)'
                    }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    </div>
                    <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 800, marginBottom: 'var(--space-2)', color: 'var(--text-primary)' }}>
                        Choose a Username
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)', lineHeight: 1.5 }}>
                        Before continuing, please select a unique username. This will be used to tag you in the anonymous board and community sections.
                    </p>
                </div>

                {error && (
                    <div className="animate-shake" style={{
                        padding: 'var(--space-3) var(--space-4)', background: 'var(--error-soft)',
                        color: 'var(--error)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', marginBottom: 'var(--space-5)'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Username</label>
                        <div style={{ position: 'relative' }}>
                            <span style={{
                                position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)',
                                color: 'var(--text-muted)', fontSize: 'var(--font-sm)', fontWeight: 600
                            }}>@</span>
                            <input
                                type="text"
                                className="form-input"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="coolstudent24"
                                style={{ paddingLeft: '32px' }}
                                required
                            />
                        </div>
                        <p style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                            Only lowercase letters, numbers, and underscores are allowed.
                        </p>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ marginTop: 'var(--space-2)', width: '100%', padding: 'var(--space-3)', fontSize: 'var(--font-base)' }}
                        disabled={loading}
                    >
                        {loading ? 'Saving...' : 'Set Username'}
                    </button>
                </form>
            </div>
        </div>
    );
}
