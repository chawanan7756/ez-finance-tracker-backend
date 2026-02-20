const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:ehWdOXlYTUrfFhvdmNjqSZQHwsItAuUj@interchange.proxy.rlwy.net:44682/railway"
    }
  }
});

async function main() {
  console.log('Fetching categories from Railway...');
  const count = await prisma.category.count();
  console.log(`Total categories: ${count}`);

  const categories = await prisma.category.findMany({
    take: 5
  });
  console.log('Sample categories:', JSON.stringify(categories, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
