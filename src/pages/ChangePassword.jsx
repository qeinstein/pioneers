import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ChangePassword() {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { changePassword, isFirstLogin } = useAuth();
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        if (newPassword !== confirm) { setError('Passwords do not match'); return; }
        if (newPassword.length < 4) { setError('Password must be at least 4 characters'); return; }
        setLoading(true);
        try {
            await changePassword(currentPassword, newPassword);
            navigate('/');
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    }

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#000', padding: 'var(--space-4)', position: 'relative', overflow: 'hidden',
        }}>
            <div className="bg-animation">
                <div className="bg-orb bg-orb-1"></div>
                <div className="bg-orb bg-orb-2"></div>
                <div className="bg-grid"></div>
            </div>

            <div className="card-static animate-scale-in" style={{
                maxWidth: '400px', width: '100%', position: 'relative', zIndex: 1,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 'var(--radius-xl)', padding: 'var(--space-8)',
            }}>
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
                    <h1 style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: '#e8e8e8' }}>
                        {isFirstLogin ? 'Set New Password' : 'Change Password'}
                    </h1>
                    <p style={{ color: '#888', fontSize: 'var(--font-sm)', marginTop: 'var(--space-2)' }}>
                        {isFirstLogin ? 'You must change your password before continuing.' : 'Update your password below.'}
                    </p>
                </div>

                {error && (
                    <div className="animate-shake" style={{
                        padding: 'var(--space-3) var(--space-4)', background: 'var(--error-soft)',
                        color: 'var(--error)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)',
                        marginBottom: 'var(--space-4)',
                    }}>{error}</div>
                )}

                <form onSubmit={handleSubmit}>
                    {!isFirstLogin && (
                        <div className="form-group">
                            <label className="form-label">Current Password</label>
                            <input className="form-input" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
                        </div>
                    )}
                    <div className="form-group">
                        <label className="form-label">New Password</label>
                        <input className="form-input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required placeholder="At least 4 characters" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Confirm New Password</label>
                        <input className="form-input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
                    </div>
                    <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%' }}>
                        {loading ? 'Updating...' : 'Update Password'}
                    </button>
                </form>
            </div>
        </div>
    );
}
