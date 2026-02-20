const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
    try {
        const transactions = await prisma.transaction.findMany({
            take: 10,
            orderBy: { date: 'desc' }
        });
        const budgets = await prisma.budget.findMany();

        console.log('--- Recent Transactions ---');
        console.log(JSON.stringify(transactions, null, 2));

        console.log('\n--- Budgets ---');
        console.log(JSON.stringify(budgets, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkData();
