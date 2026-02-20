const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testBudgetAggregation() {
    try {
        const month = "2026-02";
        // Ensure we have a budget for 'อาหาร'
        const budget = await prisma.budget.upsert({
            where: { category_month: { category: 'อาหาร', month } },
            update: { monthlyLimit: 5000 },
            create: { category: 'อาหาร', monthlyLimit: 5000, month }
        });

        // Add a transaction for 'อาหาร'
        await prisma.transaction.create({
            data: {
                type: 'expense',
                amount: 350,
                category: 'อาหาร',
                description: 'ข้าวเที่ยง',
                date: new Date()
            }
        });

        console.log('✅ Added budget and transaction for "อาหาร"');
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

testBudgetAggregation();
