const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:ehWdOXlYTUrfFhvdmNjqSZQHwsItAuUj@interchange.proxy.rlwy.net:44682/railway"
        }
    }
});

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

async function main() {
    console.log('Seeding categories to Railway...');
    for (const cat of DEFAULT_CATEGORIES) {
        const existing = await prisma.category.findFirst({
            where: { name: cat.name, lineUserId: null }
        });

        if (!existing) {
            await prisma.category.create({ data: cat });
            console.log(`Created: ${cat.name}`);
        } else {
            console.log(`Exists: ${cat.name}`);
        }
    }
    console.log('Done!');
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
