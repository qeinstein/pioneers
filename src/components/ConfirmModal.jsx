import { useState } from 'react';

export default function ConfirmModal({ title, message, onConfirm, onCancel, confirmText = 'Confirm', variant = 'danger' }) {
    const [loading, setLoading] = useState(false);
    const [responseMessage, setResponseMessage] = useState('');

    async function handleConfirm() {
        setLoading(true);
        try {
            const resultMsg = await onConfirm();
            if (resultMsg) {
                setResponseMessage(resultMsg);
                // Auto close after showing the message for 2 seconds
                setTimeout(() => {
                    onCancel(true); // true indicates successful completion
                }, 2000);
            } else {
                onCancel(true);
            }
        } catch (error) {
            setResponseMessage(error.message || 'An error occurred');
            setLoading(false);
        }
    }

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center' }}>
                {responseMessage ? (
                    <div className="animate-slide-up">
                        <div style={{
                            width: '48px', height: '48px', borderRadius: '50%',
                            background: 'var(--success-soft)', color: 'var(--success)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto var(--space-4)', fontSize: '24px'
                        }}>✓</div>
                        <h3 className="mb-2" style={{ fontWeight: 600 }}>Success</h3>
                        <p style={{ color: 'var(--text-secondary)' }}>{responseMessage}</p>
                    </div>
                ) : (
                    <>
                        <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                            {title}
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)', marginBottom: 'var(--space-6)' }}>
                            {message}
                        </p>

                        <div className="flex gap-3 justify-center">
                            <button className="btn btn-ghost" onClick={() => onCancel(false)} disabled={loading}>
                                Cancel
                            </button>
                            <button className={`btn btn-${variant}`} onClick={handleConfirm} disabled={loading}>
                                {loading ? 'Processing...' : confirmText}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
