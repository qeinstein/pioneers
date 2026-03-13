import { Link } from 'react-router-dom';

export default function LeaderboardTable({ data, currentUserId }) {
    if (!data || data.length === 0) {
        return (
            <div className="empty-state">
                <div className="empty-state-title">No rankings yet</div>
                <div className="empty-state-text">Take some quizzes to appear on the leaderboard</div>
            </div>
        );
    }

    function getMedal(rank) {
        if (rank === 1) return <span className="medal medal-gold" style={{ fontSize: 'var(--font-base)' }}>1st</span>;
        if (rank === 2) return <span className="medal medal-silver" style={{ fontSize: 'var(--font-base)' }}>2nd</span>;
        if (rank === 3) return <span className="medal medal-bronze" style={{ fontSize: 'var(--font-base)' }}>3rd</span>;
        return <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{rank}</span>;
    }

    return (
        <div className="table-container">
            <table className="table">
                <thead>
                    <tr>
                        <th style={{ width: '60px' }}>Rank</th>
                        <th>Student</th>
                        <th>Total Points</th>
                        <th>Avg Score</th>
                        <th>Best Time</th>
                        <th>Attempts</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map(row => (
                        <tr key={row.user_id} className={row.user_id === currentUserId ? 'table-highlight' : ''}>
                            <td>{getMedal(row.rank)}</td>
                            <td>
                                <Link to={`/profile/${row.user_id}`} className="flex items-center gap-3" style={{ textDecoration: 'none', color: 'inherit' }}>
                                    <div className="avatar avatar-sm">
                                        {row.profile_pic_url ? <img src={row.profile_pic_url} alt="" /> : (row.display_name || row.matric_no).slice(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>{row.display_name || row.matric_no}</div>
                                        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>{row.matric_no}</div>
                                    </div>
                                </Link>
                            </td>
                            <td>
                                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                                    {row.total_points}
                                </span>
                            </td>
                            <td style={{ fontSize: 'var(--font-sm)' }}>{row.avg_score}%</td>
                            <td style={{ fontSize: 'var(--font-sm)', fontFamily: 'var(--font-mono)' }}>{Math.floor(row.best_time / 60)}m {row.best_time % 60}s</td>
                            <td style={{ fontSize: 'var(--font-sm)' }}>{row.total_attempts}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
