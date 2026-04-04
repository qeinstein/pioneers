export async function parsePaginatedResponse(response) {
    const data = await response.json();
    return {
        items: Array.isArray(data) ? data : [],
        total: Number(response.headers.get('X-Total-Count') || 0),
        page: Number(response.headers.get('X-Page') || 1),
        limit: Number(response.headers.get('X-Limit') || 0),
    };
}

export function getTotalPages(total, limit) {
    if (!limit) return 1;
    return Math.max(1, Math.ceil(total / limit));
}
