const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        const count = await prisma.userProfile.count();
        const users = await prisma.userProfile.findMany();
        console.log('Total Users:', count);
        console.log('Users:', JSON.stringify(users, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

check();
