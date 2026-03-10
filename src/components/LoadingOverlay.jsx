export default function LoadingOverlay({ loading, children, message }) {
    if (!loading) return children;

    return (
        <div style={{ position: 'relative', minHeight: '100px' }}>
            <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: 'var(--space-3)', background: 'rgba(var(--bg-primary-rgb, 0,0,0), 0.6)',
                backdropFilter: 'blur(4px)', borderRadius: 'var(--radius-xl)', zIndex: 10,
            }}>
                <div className="spinner"></div>
                {message && <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>{message}</span>}
            </div>
            <div style={{ opacity: 0.3, pointerEvents: 'none' }}>{children}</div>
        </div>
    );
}
