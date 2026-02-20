const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/debug-logs - Submit debug log from app
router.post('/', async (req, res) => {
    try {
        const { level, tag, message, metadata, appVersion, deviceInfo, displayName } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'message is required' });
        }

        const log = await prisma.debugLog.create({
            data: {
                lineUserId: req.lineUserId || null,
                displayName: displayName || null,
                level: level || 'info',
                tag: tag || 'app',
                message,
                metadata: metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : null,
                appVersion: appVersion || null,
                deviceInfo: deviceInfo || null,
            },
        });

        res.status(201).json(log);
    } catch (err) {
        console.error('POST /debug-logs error:', err);
        res.status(500).json({ error: 'Failed to create debug log' });
    }
});

// GET /api/debug-logs - List debug logs (for admin)
router.get('/', async (req, res) => {
    try {
        const { level, tag, userId, limit = 100, offset = 0, search } = req.query;

        const where = {};
        if (level) where.level = level;
        if (tag) where.tag = tag;
        if (userId) where.lineUserId = userId;
        if (search) {
            where.OR = [
                { message: { contains: search, mode: 'insensitive' } },
                { displayName: { contains: search, mode: 'insensitive' } },
                { lineUserId: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [logs, total] = await Promise.all([
            prisma.debugLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: parseInt(limit),
                skip: parseInt(offset),
            }),
            prisma.debugLog.count({ where }),
        ]);

        res.json({
            data: logs,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: parseInt(offset) + parseInt(limit) < total,
            },
        });
    } catch (err) {
        console.error('GET /debug-logs error:', err);
        res.status(500).json({ error: 'Failed to fetch debug logs' });
    }
});

// GET /api/debug-logs/stats - Get stats summary
router.get('/stats', async (req, res) => {
    try {
        const [total, errorCount, uniqueUsers, recentLogs] = await Promise.all([
            prisma.debugLog.count(),
            prisma.debugLog.count({ where: { level: 'error' } }),
            prisma.debugLog.groupBy({ by: ['lineUserId'], _count: true }),
            prisma.debugLog.findMany({
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: { createdAt: true },
            }),
        ]);

        res.json({
            totalLogs: total,
            errorCount,
            uniqueUsers: uniqueUsers.length,
            lastLogAt: recentLogs[0]?.createdAt || null,
        });
    } catch (err) {
        console.error('GET /debug-logs/stats error:', err);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// DELETE /api/debug-logs - Clear all logs (admin action)
router.delete('/', async (req, res) => {
    try {
        const { before } = req.query;
        const where = {};
        if (before) {
            where.createdAt = { lt: new Date(before) };
        }

        const result = await prisma.debugLog.deleteMany({ where });
        res.json({ message: `Deleted ${result.count} logs` });
    } catch (err) {
        console.error('DELETE /debug-logs error:', err);
        res.status(500).json({ error: 'Failed to delete logs' });
    }
});

module.exports = router;
