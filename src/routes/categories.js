const express = require('express');
const { PrismaClient } = require('@prisma/client');

const { requireLineUser } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Default categories to seed
const DEFAULT_CATEGORIES = [
    // Expense categories
    { name: 'อาหาร', icon: '🍜', type: 'expense', color: '#FF6B6B' },
    { name: 'เครื่องดื่ม', icon: '☕', type: 'expense', color: '#E17055' },
    { name: 'เดินทาง', icon: '🚗', type: 'expense', color: '#FDCB6E' },
    { name: 'ที่อยู่อาศัย', icon: '🏠', type: 'expense', color: '#6C5CE7' },
    { name: 'ค่าสาธารณูปโภค', icon: '💡', type: 'expense', color: '#A29BFE' },
    { name: 'ช้อปปิ้ง', icon: '🛒', type: 'expense', color: '#FD79A8' },
    { name: 'สุขภาพ', icon: '🏥', type: 'expense', color: '#00B894' },
    { name: 'บันเทิง', icon: '🎮', type: 'expense', color: '#E84393' },
    { name: 'การศึกษา', icon: '📚', type: 'expense', color: '#0984E3' },
    { name: 'ออมเงิน', icon: '🐷', type: 'expense', color: '#00CEC9' },
    { name: 'หารบิล', icon: '🐥', type: 'expense', color: '#FAB1A0' },
    { name: 'โอนเงินออก', icon: '💳', type: 'expense', color: '#636E72' },
    { name: 'อื่นๆ', icon: '📦', type: 'expense', color: '#B2BEC3' },

    // Income categories
    { name: 'เงินเดือน', icon: '💼', type: 'income', color: '#00B894' },
    { name: 'โบนัส', icon: '🎉', type: 'income', color: '#00CEC9' },
    { name: 'ฟรีแลนซ์', icon: '💻', type: 'income', color: '#0984E3' },
    { name: 'รายได้จากการขาย', icon: '🏪', type: 'income', color: '#6C5CE7' },
    { name: 'ค่าจ้าง', icon: '🔨', type: 'income', color: '#FDCB6E' },
    { name: 'ดอกเบี้ย', icon: '🏦', type: 'income', color: '#A29BFE' },
    { name: 'เงินปันผล', icon: '📈', type: 'income', color: '#55EFC4' },
    { name: 'เงินคืน', icon: '🔄', type: 'income', color: '#81ECEC' },
    { name: 'โอนเงินเข้า', icon: '💰', type: 'income', color: '#74B9FF' },
    { name: 'รายได้อื่นๆ', icon: '✨', type: 'income', color: '#DFE6E9' },

    // Savings categories
    { name: 'ออมเงินสำรอง', icon: '💰', type: 'savings', color: '#00CEC9' },
    { name: 'เงินออมเพื่อการลงทุน', icon: '📈', type: 'savings', color: '#0984E3' },
    { name: 'ออมเพื่อเป้าหมาย', icon: '🎯', type: 'savings', color: '#E84393' },
    { name: 'เงินเก็บทั่วไป', icon: '🏦', type: 'savings', color: '#636E72' },
];

// GET /api/categories - List all categories
router.get('/', async (req, res) => {
    try {
        const { type } = req.query;
        const where = {
            OR: [
                { lineUserId: null }, // Global categories
                { lineUserId: req.lineUserId || 'unknown' } // User categories
            ]
        };
        if (type) where.type = type;

        let categories = await prisma.category.findMany({
            where,
            orderBy: { name: 'asc' },
        });

        // Check if global categories exist
        const globalCount = await prisma.category.count({ where: { lineUserId: null } });

        // If no global categories exist OR if we need to force update/check defaults
        if (globalCount < DEFAULT_CATEGORIES.length) {
            console.log(`[Seeder] Checking/Seeding categories. Current count: ${globalCount}`);

            // Use a transaction or parallel ops to seed
            const operations = DEFAULT_CATEGORIES.map(cat =>
                prisma.category.upsert({
                    where: {
                        name_lineUserId: {
                            name: cat.name,
                            lineUserId: null // Unique constraint is name + lineUserId
                        }
                    },
                    update: {}, // Don't change existing
                    create: cat
                }).catch(e => console.error(`[Seeder] Failed to seed ${cat.name}:`, e.message))
            );

            await Promise.all(operations);
            console.log('[Seeder] Seeding process completed.');

            // Re-fetch after seeding
            categories = await prisma.category.findMany({
                where,
                orderBy: { name: 'asc' },
            });
        }

        res.json(categories);
    } catch (err) {
        console.error('GET /categories error:', err);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// POST /api/categories - Create category
router.post('/', requireLineUser, async (req, res) => {
    try {
        const { name, icon, type, color } = req.body;

        if (!name || !type) {
            return res.status(400).json({ error: 'name and type are required' });
        }

        const category = await prisma.category.create({
            data: {
                name,
                icon: icon || '💰',
                type,
                color: color || '#4CAF50',
                lineUserId: req.lineUserId || null,
            },
        });

        res.status(201).json(category);
    } catch (err) {
        console.error('POST /categories error:', err);
        if (err.code === 'P2002') {
            return res.status(409).json({ error: 'Category name already exists' });
        }
        res.status(500).json({ error: 'Failed to create category' });
    }
});

// DELETE /api/categories/:id
router.delete('/:id', requireLineUser, async (req, res) => {
    try {
        const result = await prisma.category.deleteMany({
            where: {
                id: parseInt(req.params.id),
                lineUserId: req.lineUserId || null // Only allow deleting own categories
            },
        });

        if (result.count === 0) {
            return res.status(404).json({ error: 'Category not found or cannot delete global category' });
        }

        res.json({ message: 'Category deleted successfully' });
    } catch (err) {
        console.error('DELETE /categories/:id error:', err);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

module.exports = router;
