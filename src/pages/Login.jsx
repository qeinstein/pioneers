import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const [matric, setMatric] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState('login');
    const [registerMsg, setRegisterMsg] = useState('');
    const { login, register } = useAuth();
    const navigate = useNavigate();

    async function handleLogin(e) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const user = await login(matric, password);
            if (user.is_first_login) navigate('/change-password');
            else navigate('/');
        } catch (err) {
            setError(err.message);
        } finally { setLoading(false); }
    }

    async function handleRegister(e) {
        e.preventDefault();
        setError('');
        setRegisterMsg('');
        setLoading(true);
        try {
            const data = await register(matric);
            setRegisterMsg(data.message);
            setMode('login');
        } catch (err) {
            setError(err.message);
        } finally { setLoading(false); }
    }

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#000', padding: 'var(--space-4)', position: 'relative', overflow: 'hidden',
        }}>
            {/* Background */}
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
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
                    <h1 style={{
                        fontSize: 'var(--font-2xl)', fontWeight: 700, letterSpacing: '-0.03em',
                        color: '#e8e8e8',
                    }}>
                        <span style={{ color: 'var(--primary)' }}>P</span>ioneers
                    </h1>
                    <p style={{ color: '#888', fontSize: 'var(--font-sm)', marginTop: 'var(--space-2)' }}>
                        {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
                    </p>
                </div>

                <div className="tabs" style={{ marginBottom: 'var(--space-6)' }}>
                    <button className={`tab ${mode === 'login' ? 'active' : ''}`} onClick={() => { setMode('login'); setError(''); }}>Login</button>
                    <button className={`tab ${mode === 'register' ? 'active' : ''}`} onClick={() => { setMode('register'); setError(''); }}>Register</button>
                </div>

                {registerMsg && (
                    <div style={{
                        padding: 'var(--space-3) var(--space-4)', background: 'var(--success-soft)',
                        color: 'var(--success)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)',
                        marginBottom: 'var(--space-4)', fontWeight: 500,
                    }}>{registerMsg}</div>
                )}

                {error && (
                    <div className="animate-shake" style={{
                        padding: 'var(--space-3) var(--space-4)', background: 'var(--error-soft)',
                        color: 'var(--error)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)',
                        marginBottom: 'var(--space-4)', fontWeight: 500,
                    }}>{error}</div>
                )}

                <form onSubmit={mode === 'login' ? handleLogin : handleRegister}>
                    <div className="form-group">
                        <label className="form-label">Matriculation Number</label>
                        <input
                            className="form-input"
                            type="text"
                            placeholder="e.g. 240805099"
                            value={matric}
                            onChange={e => setMatric(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>

                    {mode === 'login' && (
                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <input
                                className="form-input"
                                type="password"
                                placeholder="Enter your password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%' }}>
                        {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
                    </button>
                </form>

                {mode === 'register' && (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-xs)', marginTop: 'var(--space-4)' }}>
                        Your default password will be the last 4 characters of your matric number.
                    </p>
                )}
            </div>
        </div>
    );
}
