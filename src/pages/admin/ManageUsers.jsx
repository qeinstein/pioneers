import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ConfirmModal from '../../components/ConfirmModal';

export default function ManageUsers() {
    const { token } = useAuth();
    const [users, setUsers] = useState([]);
    const [matrics, setMatrics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('users');
    const [addMode, setAddMode] = useState('single');
    const [singleMatric, setSingleMatric] = useState('');
    const [prefix, setPrefix] = useState('CSC/2023/');
    const [rangeStart, setRangeStart] = useState('');
    const [rangeEnd, setRangeEnd] = useState('');
    const [msg, setMsg] = useState('');
    const [confirmAction, setConfirmAction] = useState(null);

    useEffect(() => {
        Promise.all([
            fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
            fetch('/api/admin/allowed-matrics', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        ]).then(([u, m]) => { setUsers(u); setMatrics(m); }).finally(() => setLoading(false));
    }, []);

    function changeRole(u, newRole) {
        setConfirmAction({
            title: newRole === 'admin' ? 'Promote to Administrator' : 'Demote Administrator',
            message: `Are you sure you want to ${newRole === 'admin' ? 'invite' : 'demote'} ${u.display_name || u.matric_no}?`,
            confirmText: newRole === 'admin' ? 'Promote' : 'Demote',
            variant: newRole === 'admin' ? 'warning' : 'danger',
            action: async () => {
                const res = await fetch(`/api/admin/users/${u.id}/role`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ role: newRole }) });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to update role');
                if (data.status === 'Pending' || newRole === 'admin') {
                    setUsers(prev => prev.map(user => user.id === u.id ? { ...user, pending_admin: true } : user));
                } else {
                    setUsers(prev => prev.map(user => user.id === u.id ? { ...user, role: newRole } : user));
                }
                setMsg(data.message);
                return data.message;
            }
        });
    }

    function resetPassword(u) {
        setConfirmAction({
            title: 'Reset Password',
            message: `Reset password for ${u.display_name || u.matric_no} to default?`,
            confirmText: 'Reset',
            variant: 'danger',
            action: async () => {
                const res = await fetch(`/api/admin/users/${u.id}/reset-password`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to reset password');
                setMsg(data.message);
                return data.message;
            }
        });
    }

    async function addMatric() {
        setMsg('');
        const body = addMode === 'single' ? { matric_no: singleMatric } : { prefix, range_start: parseInt(rangeStart), range_end: parseInt(rangeEnd) };
        const res = await fetch('/api/admin/allowed-matrics', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
        const data = await res.json();
        setMsg(data.message); setSingleMatric(''); setRangeStart(''); setRangeEnd('');
        const m = await fetch('/api/admin/allowed-matrics', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
        setMatrics(m);
    }

    function removeMatric(m) {
        setConfirmAction({
            title: 'Remove Whitelist Entry',
            message: `Remove ${m.matric_no} from the whitelist?`,
            confirmText: 'Remove',
            variant: 'danger',
            action: async () => {
                const res = await fetch(`/api/admin/allowed-matrics/${m.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to remove');
                setMatrics(prev => prev.filter(mat => mat.id !== m.id));
                setMsg(data.message || 'Removed from whitelist');
                return data.message || 'Removed from whitelist';
            }
        });
    }

    if (loading) return <div className="page-container"><div className="loading-spinner"><div className="spinner"></div></div></div>;

    return (
        <>
            {confirmAction && (
                <ConfirmModal
                    title={confirmAction.title}
                    message={confirmAction.message}
                    confirmText={confirmAction.confirmText}
                    variant={confirmAction.variant}
                    onConfirm={confirmAction.action}
                    onCancel={() => setConfirmAction(null)}
                />
            )}
            <div className="page-container">
                <Link to="/admin" className="back-link">Back to Admin</Link>
                <div className="page-header animate-slide-up"><h1 className="page-title">Manage Users</h1></div>

                <div className="tabs mb-6" style={{ maxWidth: '400px' }}>
                    <button className={`tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>Registered Users</button>
                    <button className={`tab ${tab === 'whitelist' ? 'active' : ''}`} onClick={() => setTab('whitelist')}>Matric Whitelist</button>
                </div>

                {msg && <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--success-soft)', color: 'var(--success)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', marginBottom: 'var(--space-4)' }}>{msg}</div>}

                {tab === 'users' ? (
                    <div className="table-container animate-slide-up">
                        <table className="table">
                            <thead><tr><th>User</th><th>Role</th><th>Attempts</th><th>Joined</th><th>Actions</th></tr></thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.id}>
                                        <td>
                                            <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>{u.display_name || u.matric_no}</div>
                                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>{u.matric_no}</div>
                                        </td>
                                        <td><span className={`badge ${u.role === 'admin' ? 'badge-warning' : 'badge-info'}`}>{u.role}</span></td>
                                        <td style={{ fontSize: 'var(--font-sm)' }}>{u.quiz_attempts}</td>
                                        <td style={{ fontSize: 'var(--font-xs)' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                                        <td>
                                            <div className="flex gap-2">
                                                {u.role === 'student' && !u.pending_admin ? (
                                                    <button className="btn btn-ghost btn-sm" onClick={() => changeRole(u, 'admin')}>Promote</button>
                                                ) : u.pending_admin ? (
                                                    <span className="badge badge-warning">Pending Invite</span>
                                                ) : u.matric_no !== '240805099' && (
                                                    <button className="btn btn-danger btn-sm" onClick={() => changeRole(u, 'student')}>Demote</button>
                                                )}
                                                <button className="btn btn-ghost btn-sm" onClick={() => resetPassword(u)}>Reset Pass</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="animate-slide-up">
                        <div className="card-static mb-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)' }}>
                            <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-4)', fontSize: 'var(--font-sm)' }}>Add Matric Numbers</h3>
                            <div className="tabs mb-4" style={{ maxWidth: '300px' }}>
                                <button className={`tab ${addMode === 'single' ? 'active' : ''}`} onClick={() => setAddMode('single')}>Single</button>
                                <button className={`tab ${addMode === 'range' ? 'active' : ''}`} onClick={() => setAddMode('range')}>Range</button>
                            </div>
                            {addMode === 'single' ? (
                                <div className="flex gap-3">
                                    <input className="form-input" value={singleMatric} onChange={e => setSingleMatric(e.target.value)} placeholder="e.g. 240805051" style={{ flex: 1 }} />
                                    <button className="btn btn-primary" onClick={addMatric} disabled={!singleMatric}>Add</button>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    <div className="form-group"><label className="form-label">Prefix</label><input className="form-input" value={prefix} onChange={e => setPrefix(e.target.value)} /></div>
                                    <div className="flex gap-3">
                                        <div className="form-group" style={{ flex: 1 }}><label className="form-label">Start</label><input className="form-input" type="number" value={rangeStart} onChange={e => setRangeStart(e.target.value)} placeholder="1" /></div>
                                        <div className="form-group" style={{ flex: 1 }}><label className="form-label">End</label><input className="form-input" type="number" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} placeholder="150" /></div>
                                    </div>
                                    <button className="btn btn-primary" onClick={addMatric} disabled={!prefix || !rangeStart || !rangeEnd}>Add Range</button>
                                </div>
                            )}
                        </div>

                        <div className="table-container">
                            <table className="table">
                                <thead><tr><th>Matric Number</th><th>Added By</th><th>Date</th><th></th></tr></thead>
                                <tbody>
                                    {matrics.slice(0, 50).map(m => (
                                        <tr key={m.id}>
                                            <td style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>{m.matric_no}</td>
                                            <td style={{ fontSize: 'var(--font-sm)' }}>{m.added_by_name || '—'}</td>
                                            <td style={{ fontSize: 'var(--font-xs)' }}>{new Date(m.created_at).toLocaleDateString()}</td>
                                            <td><button className="btn btn-danger btn-sm" onClick={() => removeMatric(m)}>Remove</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {matrics.length > 50 && <div style={{ padding: 'var(--space-3)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>Showing 50 of {matrics.length}</div>}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
