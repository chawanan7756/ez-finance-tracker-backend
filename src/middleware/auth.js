/**
 * Middleware to extract LINE User ID from headers
 */
const authMiddleware = (req, res, next) => {
    const lineUserId = req.header('X-Line-User-Id');

    if (req.url.startsWith('/api')) {
        console.log(`[Auth] ${req.method} ${req.url} - X-Line-User-Id: ${lineUserId || 'MISSING'}`);
    }

    // Attach to request object
    req.lineUserId = lineUserId || null;

    next();
};

/**
 * Middleware to require LINE User ID for protected routes
 */
const requireLineUser = (req, res, next) => {
    if (!req.lineUserId) {
        console.warn(`[Auth] Unauthorized access attempt to ${req.method} ${req.url} - Missing req.lineUserId`);
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'X-Line-User-Id header is required'
        });
    }
    next();
};

module.exports = { authMiddleware, requireLineUser };
