import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const POLL_COLORS = [
    { gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', bar: '#667eea' },
    { gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', bar: '#f5576c' },
    { gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', bar: '#4facfe' },
    { gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', bar: '#43e97b' },
    { gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', bar: '#fa709a' },
    { gradient: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)', bar: '#a18cd1' },
    { gradient: 'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)', bar: '#d57eeb' },
    { gradient: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)', bar: '#8ec5fc' },
];

const OPTION_COLORS = [
    '#667eea', '#f5576c', '#43e97b', '#4facfe', '#fa709a',
    '#fccb90', '#a18cd1', '#38f9d7', '#fee140', '#d57eeb'
];

export default function Voting() {
    const { token, user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [polls, setPolls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [options, setOptions] = useState(['', '']);
    const [submitting, setSubmitting] = useState(false);
    const [msg, setMsg] = useState('');
    const [votingId, setVotingId] = useState(null);

    useEffect(() => {
        fetchPolls();
    }, []);

    async function fetchPolls() {
        try {
            const res = await fetch('/api/polls', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) setPolls(await res.json());
        } finally {
            setLoading(false);
        }
    }

    async function handleCreatePoll(e) {
        e.preventDefault();
        setSubmitting(true);
        setMsg('');
        try {
            const validOptions = options.filter(o => o.trim());
            if (validOptions.length < 2) {
                setMsg('At least 2 options are required');
                setSubmitting(false);
                return;
            }
            const res = await fetch('/api/polls', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ title, description, options: validOptions })
            });
            if (res.ok) {
                setMsg('Poll created!');
                setTitle(''); setDescription(''); setOptions(['', '']); setShowForm(false);
                fetchPolls();
            } else {
                const data = await res.json();
                setMsg(data.error || 'Failed to create poll');
            }
        } catch {
            setMsg('Failed to connect');
        } finally {
            setSubmitting(false);
        }
    }

    async function handleVote(pollId, optionId) {
        setVotingId(pollId);
        try {
            const res = await fetch(`/api/polls/${pollId}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ option_id: optionId })
            });
            if (res.ok) fetchPolls();
        } finally {
            setVotingId(null);
        }
    }

    async function togglePublic(pollId, currentPublic) {
        await fetch(`/api/polls/${pollId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ is_public: !currentPublic })
        });
        fetchPolls();
    }

    async function toggleActive(pollId, currentActive) {
        await fetch(`/api/polls/${pollId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ is_active: !currentActive })
        });
        fetchPolls();
    }

    async function deletePoll(pollId) {
        if (!confirm('Delete this poll and all its votes?')) return;
        await fetch(`/api/polls/${pollId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        fetchPolls();
    }

    function addOption() {
        if (options.length < 10) setOptions([...options, '']);
    }

    function removeOption(i) {
        if (options.length > 2) setOptions(options.filter((_, idx) => idx !== i));
    }

    function updateOption(i, val) {
        const newOpts = [...options];
        newOpts[i] = val;
        setOptions(newOpts);
    }

    return (
        <div className="page-container flex flex-col gap-6">
            <div className="page-header">
                <div>
                    <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <span style={{ fontSize: '1.4em' }}>🗳️</span> Voting
                    </h1>
                    <p className="page-subtitle">Have your say — vote on community polls!</p>
                </div>
                {isAdmin && (
                    <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
                        {showForm ? 'Cancel' : '+ Create Poll'}
                    </button>
                )}
            </div>

            {msg && (
                <div className={`badge ${msg.includes('created') || msg.includes('Poll') ? 'badge-success' : 'badge-danger'}`}
                    style={{ padding: 'var(--space-3)', fontSize: 'var(--font-sm)' }}>{msg}</div>
            )}

            {/* Create Poll Form (Admin only) */}
            {showForm && isAdmin && (
                <div className="card-static animate-scale-in" style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)',
                    backgroundImage: 'linear-gradient(135deg, rgba(102,126,234,0.05) 0%, rgba(118,75,162,0.05) 100%)'
                }}>
                    <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span>📊</span> Create a New Poll
                    </h2>
                    <form onSubmit={handleCreatePoll} className="flex flex-col gap-4">
                        <div>
                            <label className="form-label">Question / Title *</label>
                            <input type="text" className="form-input" value={title}
                                onChange={e => setTitle(e.target.value)} required
                                placeholder="e.g., What day should we have the meetup?" />
                        </div>
                        <div>
                            <label className="form-label">Description (optional)</label>
                            <input type="text" className="form-input" value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="More context about this poll..." />
                        </div>
                        <div>
                            <label className="form-label">Options *</label>
                            <div className="flex flex-col gap-2">
                                {options.map((opt, i) => (
                                    <div key={i} style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                                        <div style={{
                                            width: '12px', height: '12px', borderRadius: '50%',
                                            background: OPTION_COLORS[i % OPTION_COLORS.length],
                                            flexShrink: 0
                                        }} />
                                        <input type="text" className="form-input" value={opt}
                                            onChange={e => updateOption(i, e.target.value)}
                                            placeholder={`Option ${i + 1}`}
                                            style={{ flex: 1 }} />
                                        {options.length > 2 && (
                                            <button type="button" onClick={() => removeOption(i)}
                                                style={{
                                                    background: 'none', border: 'none', color: 'var(--error)',
                                                    cursor: 'pointer', fontSize: '18px', padding: '4px'
                                                }}>×</button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {options.length < 10 && (
                                <button type="button" onClick={addOption} className="btn btn-ghost btn-sm"
                                    style={{ marginTop: 'var(--space-2)' }}>
                                    + Add Option
                                </button>
                            )}
                        </div>
                        <div className="flex justify-end mt-2">
                            <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
                                {submitting ? 'Creating...' : 'Create Poll'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Polls List */}
            {loading ? (
                <div className="loading-spinner"><div className="spinner"></div></div>
            ) : polls.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">🗳️</div>
                    <div className="empty-state-title">No polls yet</div>
                    <p style={{ color: 'var(--text-muted)' }}>
                        {isAdmin ? 'Create the first poll!' : 'Check back soon for new polls.'}
                    </p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 'var(--space-5)' }}>
                    {polls.map((poll, pollIdx) => {
                        const color = POLL_COLORS[pollIdx % POLL_COLORS.length];
                        const isClosed = !poll.is_active;
                        const hasVoted = poll.user_voted_option !== null;

                        return (
                            <div key={poll.id} className="card-static" style={{
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-xl)',
                                overflow: 'hidden',
                                opacity: isClosed ? 0.75 : 1,
                                transition: 'transform 0.2s, box-shadow 0.2s',
                            }}>
                                {/* Colorful top bar */}
                                <div style={{
                                    background: color.gradient,
                                    height: '6px'
                                }} />

                                <div style={{ padding: 'var(--space-5)' }}>
                                    {/* Header */}
                                    <div style={{ marginBottom: 'var(--space-4)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                                            <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 700, flex: 1 }}>{poll.title}</h3>
                                            <div style={{ display: 'flex', gap: 'var(--space-1)', flexShrink: 0 }}>
                                                {isClosed && (
                                                    <span className="badge" style={{
                                                        background: 'var(--bg-input)', color: 'var(--text-muted)',
                                                        fontSize: '10px', padding: '2px 8px'
                                                    }}>CLOSED</span>
                                                )}
                                                {poll.is_public === 1 && (
                                                    <span className="badge" style={{
                                                        background: 'rgba(67,233,123,0.15)', color: '#43e97b',
                                                        fontSize: '10px', padding: '2px 8px'
                                                    }}>PUBLIC</span>
                                                )}
                                            </div>
                                        </div>
                                        {poll.description && (
                                            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
                                                {poll.description}
                                            </p>
                                        )}
                                        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-2)' }}>
                                            By {poll.creator_name} • {poll.total_votes} vote{poll.total_votes !== 1 ? 's' : ''}
                                        </div>
                                    </div>

                                    {/* Options */}
                                    <div className="flex flex-col gap-2">
                                        {poll.options.map((opt, optIdx) => {
                                            const isSelected = poll.user_voted_option === opt.id;
                                            const pct = poll.can_see_results && poll.total_votes > 0
                                                ? Math.round((opt.vote_count / poll.total_votes) * 100)
                                                : 0;
                                            const barColor = OPTION_COLORS[optIdx % OPTION_COLORS.length];
                                            const canVote = !isClosed && !hasVoted;

                                            return (
                                                <div key={opt.id}
                                                    onClick={() => canVote && handleVote(poll.id, opt.id)}
                                                    style={{
                                                        position: 'relative',
                                                        borderRadius: 'var(--radius-lg)',
                                                        border: isSelected
                                                            ? `2px solid ${barColor}`
                                                            : '2px solid var(--border-color)',
                                                        padding: 'var(--space-3) var(--space-4)',
                                                        cursor: canVote ? 'pointer' : 'default',
                                                        overflow: 'hidden',
                                                        transition: 'all 0.3s ease',
                                                        background: isSelected
                                                            ? `${barColor}15`
                                                            : 'transparent',
                                                    }}
                                                    onMouseEnter={e => {
                                                        if (canVote) e.currentTarget.style.borderColor = barColor;
                                                    }}
                                                    onMouseLeave={e => {
                                                        if (canVote && !isSelected) e.currentTarget.style.borderColor = 'var(--border-color)';
                                                    }}
                                                >
                                                    {/* Progress bar background */}
                                                    {poll.can_see_results && (
                                                        <div style={{
                                                            position: 'absolute',
                                                            top: 0, left: 0, bottom: 0,
                                                            width: `${pct}%`,
                                                            background: `${barColor}20`,
                                                            transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                                                            borderRadius: 'var(--radius-lg)',
                                                        }} />
                                                    )}

                                                    <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                                            <div style={{
                                                                width: '18px', height: '18px', borderRadius: '50%',
                                                                border: isSelected ? 'none' : `2px solid ${barColor}40`,
                                                                background: isSelected ? barColor : 'transparent',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                transition: 'all 0.2s',
                                                                flexShrink: 0
                                                            }}>
                                                                {isSelected && (
                                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                                        <polyline points="20 6 9 17 4 12" />
                                                                    </svg>
                                                                )}
                                                            </div>
                                                            <span style={{ fontWeight: isSelected ? 600 : 400, fontSize: 'var(--font-sm)' }}>
                                                                {opt.option_text}
                                                            </span>
                                                        </div>
                                                        {poll.can_see_results && (
                                                            <span style={{
                                                                fontWeight: 700, fontSize: 'var(--font-sm)',
                                                                color: barColor, minWidth: '40px', textAlign: 'right'
                                                            }}>
                                                                {pct}%
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Admin controls */}
                                    {isAdmin && (
                                        <div style={{
                                            marginTop: 'var(--space-4)', paddingTop: 'var(--space-3)',
                                            borderTop: '1px solid var(--border-color)',
                                            display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap'
                                        }}>
                                            <button
                                                className={`btn btn-sm ${poll.is_public ? 'btn-ghost' : 'btn-primary'}`}
                                                onClick={() => togglePublic(poll.id, poll.is_public === 1)}
                                                style={{ fontSize: 'var(--font-xs)' }}
                                            >
                                                {poll.is_public ? 'Hide Results' : 'Show Results'}
                                            </button>
                                            <button
                                                className={`btn btn-sm ${isClosed ? 'btn-primary' : 'btn-ghost'}`}
                                                onClick={() => toggleActive(poll.id, poll.is_active === 1)}
                                                style={{ fontSize: 'var(--font-xs)' }}
                                            >
                                                {isClosed ? 'Reopen' : 'Close'}
                                            </button>
                                            <button
                                                className="btn btn-sm btn-ghost btn-danger"
                                                onClick={() => deletePoll(poll.id)}
                                                style={{ fontSize: 'var(--font-xs)', marginLeft: 'auto' }}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    )}

                                    {/* User feedback */}
                                    {!isAdmin && hasVoted && !poll.can_see_results && (
                                        <p style={{
                                            marginTop: 'var(--space-3)', fontSize: 'var(--font-xs)',
                                            color: 'var(--text-muted)', textAlign: 'center', fontStyle: 'italic'
                                        }}>
                                            Your vote has been recorded! Results will be shared soon.
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
