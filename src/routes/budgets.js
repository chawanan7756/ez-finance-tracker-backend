const express = require('express');
const { PrismaClient } = require('@prisma/client');

const { requireLineUser } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Apply auth middleware to all budget routes
router.use(requireLineUser);

// GET /api/budgets - List budgets (optionally filter by month)
router.get('/', async (req, res) => {
    try {
        const { month } = req.query;
        const where = {
            lineUserId: req.lineUserId || null
        };
        if (month) where.month = month;

        const budgets = await prisma.budget.findMany({
            where,
            orderBy: { category: 'asc' },
        });

        // If month is specified, also get actual spending for each category
        if (month) {
            const [year, mon] = month.split('-').map(Number);
            const startDate = new Date(year, mon - 1, 1);
            const endDate = new Date(year, mon, 0, 23, 59, 59);

            const transactions = await prisma.transaction.findMany({
                where: {
                    lineUserId: req.lineUserId || null,
                    type: 'expense',
                    date: { gte: startDate, lte: endDate },
                },
            });

            // Calculate actual spending per category
            const actualSpending = {};
            transactions.forEach((t) => {
                actualSpending[t.category] =
                    (actualSpending[t.category] || 0) + t.amount;
            });

            const budgetsWithActual = budgets.map((b) => ({
                ...b,
                actualSpending: actualSpending[b.category] || 0,
                remaining: b.monthlyLimit - (actualSpending[b.category] || 0),
                percentUsed: Math.round(
                    ((actualSpending[b.category] || 0) / b.monthlyLimit) * 100
                ),
            }));

            return res.json(budgetsWithActual);
        }

        res.json(budgets);
    } catch (err) {
        console.error('GET /budgets error:', err);
        res.status(500).json({ error: 'Failed to fetch budgets' });
    }
});

// POST /api/budgets - Create or update budget
router.post('/', async (req, res) => {
    try {
        const { category, monthlyLimit, month } = req.body;

        if (!category || !monthlyLimit || !month) {
            return res
                .status(400)
                .json({ error: 'category, monthlyLimit, and month are required' });
        }

        const budget = await prisma.budget.upsert({
            where: {
                category_month_lineUserId: {
                    category,
                    month,
                    lineUserId: req.lineUserId || null
                },
            },
            update: {
                monthlyLimit: parseFloat(monthlyLimit),
            },
            create: {
                category,
                monthlyLimit: parseFloat(monthlyLimit),
                month,
                lineUserId: req.lineUserId || null,
            },
        });

        res.status(201).json(budget);
    } catch (err) {
        console.error('POST /budgets error:', err);
        res.status(500).json({ error: 'Failed to create/update budget' });
    }
});

// PUT /api/budgets/:id - Update budget
router.put('/:id', async (req, res) => {
    try {
        const { monthlyLimit } = req.body;

        const result = await prisma.budget.updateMany({
            where: {
                id: parseInt(req.params.id),
                lineUserId: req.lineUserId || null
            },
            data: { monthlyLimit: parseFloat(monthlyLimit) },
        });

        if (result.count === 0) {
            return res.status(404).json({ error: 'Budget not found or unauthorized' });
        }

        // Return the updated item (heuristic: find the one we just updated)
        const budget = await prisma.budget.findFirst({
            where: { id: parseInt(req.params.id) }
        });

        res.json(budget);
    } catch (err) {
        console.error('PUT /budgets/:id error:', err);
        if (err.code === 'P2025') {
            return res.status(404).json({ error: 'Budget not found' });
        }
        res.status(500).json({ error: 'Failed to update budget' });
    }
});

// DELETE /api/budgets/:id - Delete budget
router.delete('/:id', async (req, res) => {
    try {
        const result = await prisma.budget.deleteMany({
            where: {
                id: parseInt(req.params.id),
                lineUserId: req.lineUserId || null
            },
        });

        if (result.count === 0) {
            return res.status(404).json({ error: 'Budget not found or unauthorized' });
        }

        res.json({ message: 'Budget deleted successfully' });
    } catch (err) {
        console.error('DELETE /budgets/:id error:', err);
        if (err.code === 'P2025') {
            return res.status(404).json({ error: 'Budget not found' });
        }
        res.status(500).json({ error: 'Failed to delete budget' });
    }
});

module.exports = router;
