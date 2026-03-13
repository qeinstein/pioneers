import { useState } from 'react';

export default function RolePopup({ promotions, demotions, token, onDone }) {
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(0);

    const allItems = [
        ...demotions.map(d => ({ type: 'demotion', ...d })),
        ...promotions.map(p => ({ type: 'promotion', ...p })),
    ];

    if (allItems.length === 0 || step >= allItems.length) return null;

    const item = allItems[step];

    async function handlePromotion(action) {
        setLoading(true);
        try {
            const res = await fetch(`/api/auth/pending-actions/${item.id}/respond`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ action }),
            });
            const data = await res.json();
            if (step + 1 >= allItems.length) {
                onDone(data.new_role, data.token);
            } else {
                setStep(s => s + 1);
            }
        } catch {
            if (step + 1 >= allItems.length) onDone(null, null);
            else setStep(s => s + 1);
        } finally { setLoading(false); }
    }

    async function handleDemotionAck() {
        setLoading(true);
        try {
            await fetch('/api/auth/acknowledge-demotion', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
        } catch { }
        if (step + 1 >= allItems.length) onDone('student');
        else setStep(s => s + 1);
        setLoading(false);
    }

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '420px', textAlign: 'center' }}>
                {item.type === 'promotion' ? (
                    <>
                        <div style={{
                            width: '56px', height: '56px', borderRadius: 'var(--radius-full)',
                            background: 'var(--primary-soft)', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', margin: '0 auto var(--space-4)',
                            fontSize: 'var(--font-xl)', fontWeight: 700, color: 'var(--primary)',
                        }}>A</div>
                        <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                            Admin Invitation
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)', marginBottom: 'var(--space-2)' }}>
                            {item.requested_by_name || 'An administrator'} has invited you to become an admin.
                        </p>
                        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-xs)', marginBottom: 'var(--space-6)' }}>
                            As an admin, you can manage users, courses, and quizzes.
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button className="btn btn-ghost" onClick={() => handlePromotion('decline')} disabled={loading}>
                                {loading ? 'Please wait...' : 'Decline'}
                            </button>
                            <button className="btn btn-primary" onClick={() => handlePromotion('accept')} disabled={loading}>
                                {loading ? 'Please wait...' : 'Accept'}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div style={{
                            width: '56px', height: '56px', borderRadius: 'var(--radius-full)',
                            background: 'var(--warning-soft)', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', margin: '0 auto var(--space-4)',
                            fontSize: 'var(--font-xl)', fontWeight: 700, color: 'var(--warning)',
                        }}>!</div>
                        <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                            Access Update
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)', marginBottom: 'var(--space-6)' }}>
                            {item.message}
                        </p>
                        <button className="btn btn-primary" onClick={handleDemotionAck} disabled={loading}>
                            {loading ? 'Please wait...' : 'Understood'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
