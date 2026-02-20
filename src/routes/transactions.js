const express = require('express');
const { PrismaClient } = require('@prisma/client');

const { requireLineUser } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Apply auth middleware to all transaction routes
router.use(requireLineUser);

// GET /api/transactions - List transactions with filters
router.get('/', async (req, res) => {
    try {
        const {
            type,
            category,
            source,
            startDate,
            endDate,
            limit = 50,
            offset = 0,
            sortBy = 'date',
            sortOrder = 'desc',
        } = req.query;

        const where = {};
        if (req.lineUserId) where.lineUserId = req.lineUserId;

        if (type) where.type = type;
        if (category) where.category = category;
        if (source) where.source = source;

        if (startDate || endDate) {
            where.date = {};
            if (startDate) where.date.gte = new Date(startDate);
            if (endDate) where.date.lte = new Date(endDate);
        }

        const [transactions, total] = await Promise.all([
            prisma.transaction.findMany({
                where,
                orderBy: { [sortBy]: sortOrder },
                take: parseInt(limit),
                skip: parseInt(offset),
            }),
            prisma.transaction.count({ where }),
        ]);

        res.json({
            data: transactions,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: parseInt(offset) + parseInt(limit) < total,
            },
        });
    } catch (err) {
        console.error('GET /transactions error:', err);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// GET /api/transactions/summary - Get monthly summary
router.get('/summary', async (req, res) => {
    try {
        const { month, year } = req.query;

        const now = new Date();
        const targetYear = parseInt(year) || now.getFullYear();
        const targetMonth = parseInt(month) || now.getMonth() + 1;

        const startDate = new Date(targetYear, targetMonth - 1, 1);
        const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

        const transactions = await prisma.transaction.findMany({
            where: {
                lineUserId: req.lineUserId || null,
                date: { gte: startDate, lte: endDate },
            },
        });

        const income = transactions
            .filter((t) => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);

        const expense = transactions
            .filter((t) => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);

        const savings = transactions
            .filter((t) => t.type === 'savings')
            .reduce((sum, t) => sum + t.amount, 0);

        // Category breakdown
        const categoryBreakdown = {};
        transactions.forEach((t) => {
            if (!categoryBreakdown[t.category]) {
                categoryBreakdown[t.category] = { income: 0, expense: 0, savings: 0, count: 0 };
            }
            categoryBreakdown[t.category][t.type] += t.amount;
            categoryBreakdown[t.category].count++;
        });

        // Daily breakdown
        const dailyBreakdown = {};
        transactions.forEach((t) => {
            const day = t.date.toISOString().split('T')[0];
            if (!dailyBreakdown[day]) {
                dailyBreakdown[day] = { income: 0, expense: 0, savings: 0, count: 0 };
            }
            dailyBreakdown[day][t.type] += t.amount;
            dailyBreakdown[day].count++;
        });

        res.json({
            month: targetMonth,
            year: targetYear,
            totalIncome: income,
            totalExpense: expense,
            totalSavings: savings,
            balance: income - expense - savings,
            transactionCount: transactions.length,
            categoryBreakdown,
            dailyBreakdown,
        });
    } catch (err) {
        console.error('GET /transactions/summary error:', err);
        res.status(500).json({ error: 'Failed to fetch summary' });
    }
});

// GET /api/transactions/:id - Get single transaction
router.get('/:id', async (req, res) => {
    try {
        const transaction = await prisma.transaction.findFirst({
            where: {
                id: parseInt(req.params.id),
                lineUserId: req.lineUserId || null
            },
        });

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        res.json(transaction);
    } catch (err) {
        console.error('GET /transactions/:id error:', err);
        res.status(500).json({ error: 'Failed to fetch transaction' });
    }
});

// POST /api/transactions - Create transaction
router.post('/', async (req, res) => {
    try {
        const { type, amount, category, description, source, date } = req.body;

        if (!type || !amount || !category) {
            return res
                .status(400)
                .json({ error: 'type, amount, and category are required' });
        }

        if (!['income', 'expense', 'savings'].includes(type)) {
            return res
                .status(400)
                .json({ error: 'type must be "income", "expense", or "savings"' });
        }

        const transaction = await prisma.transaction.create({
            data: {
                type,
                amount: parseFloat(amount),
                category,
                description: description || null,
                source: source || 'manual',
                date: date ? new Date(date) : new Date(),
                lineUserId: req.lineUserId || null,
            },
        });

        res.status(201).json(transaction);
    } catch (err) {
        console.error('POST /transactions error:', err);
        res.status(500).json({ error: 'Failed to create transaction' });
    }
});

// PUT /api/transactions/:id - Update transaction
router.put('/:id', async (req, res) => {
    try {
        const { type, amount, category, description, date } = req.body;

        const transaction = await prisma.transaction.updateMany({
            where: {
                id: parseInt(req.params.id),
                lineUserId: req.lineUserId || null
            },
            data: {
                ...(type && { type }),
                ...(amount && { amount: parseFloat(amount) }),
                ...(category && { category }),
                ...(description !== undefined && { description }),
                ...(date && { date: new Date(date) }),
            },
        });

        res.json(transaction);
    } catch (err) {
        console.error('PUT /transactions/:id error:', err);
        if (err.code === 'P2025') {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        res.status(500).json({ error: 'Failed to update transaction' });
    }
});

// DELETE /api/transactions/:id - Delete transaction
router.delete('/:id', async (req, res) => {
    try {
        const result = await prisma.transaction.deleteMany({
            where: {
                id: parseInt(req.params.id),
                lineUserId: req.lineUserId || null
            },
        });

        if (result.count === 0) {
            return res.status(404).json({ error: 'Transaction not found or unauthorized' });
        }

        res.json({ message: 'Transaction deleted successfully' });
    } catch (err) {
        console.error('DELETE /transactions/:id error:', err);
        if (err.code === 'P2025') {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        res.status(500).json({ error: 'Failed to delete transaction' });
    }
});

module.exports = router;
