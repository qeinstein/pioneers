export function parsePositiveInt(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getPagination(query, options = {}) {
    const {
        defaultPage = 1,
        defaultLimit = 20,
        maxLimit = 100,
    } = options;

    const page = parsePositiveInt(query.page, defaultPage);
    const requestedLimit = parsePositiveInt(query.limit, defaultLimit);
    const limit = Math.min(requestedLimit, maxLimit);
    const offset = (page - 1) * limit;

    return { page, limit, offset };
}

export function setPaginationHeaders(res, { page, limit, total }) {
    res.set('X-Page', String(page));
    res.set('X-Limit', String(limit));
    res.set('X-Total-Count', String(total));
    res.set('Access-Control-Expose-Headers', 'X-Page, X-Limit, X-Total-Count');
}
