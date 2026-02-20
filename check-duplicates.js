const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDuplicates() {
    try {
        const categories = await prisma.category.findMany({
            orderBy: { name: 'asc' },
        });

        console.log('Total categories:', categories.length);

        const summary = {};
        categories.forEach(cat => {
            const key = `${cat.name} (${cat.type}) [User: ${cat.lineUserId}]`;
            summary[key] = (summary[key] || 0) + 1;
        });

        console.log('--- Category Summary ---');
        Object.entries(summary).forEach(([key, count]) => {
            if (count > 1) {
                console.log(`DUPLICATE: ${key} - Count: ${count}`);
            } else {
                // console.log(`${key} - Count: 1`);
            }
        });

        if (categories.length > 0) {
            console.log('Sample data:', JSON.stringify(categories.slice(0, 5), null, 2));
        }
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

checkDuplicates();
