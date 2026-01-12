import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkPlans() {
  try {
    console.log('🔍 Checking all shop plans in database:\n');

    const settings = await prisma.widgetSettings.findMany({
      select: {
        shop: true,
        plan: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    console.log(`Total shops: ${settings.length}\n`);

    const planCounts = {};
    settings.forEach(s => {
      planCounts[s.plan || 'NULL'] = (planCounts[s.plan || 'NULL'] || 0) + 1;
    });

    console.log('📊 Plan Distribution:');
    Object.entries(planCounts).forEach(([plan, count]) => {
      console.log(`  ${plan}: ${count} shops`);
    });

    console.log('\n📋 Recent shops (last 10):');
    settings.slice(0, 10).forEach(s => {
      const shop = s.shop.padEnd(40);
      const plan = (s.plan || 'NULL').padEnd(15);
      console.log(`  ${shop} | Plan: ${plan} | Updated: ${s.updatedAt.toISOString()}`);
    });

    // Check for STARTER plans specifically
    const starterShops = settings.filter(s => s.plan === 'STARTER');
    console.log(`\n⭐ STARTER plan shops: ${starterShops.length}`);
    if (starterShops.length > 0) {
      console.log('First 5 STARTER shops:');
      starterShops.slice(0, 5).forEach(s => {
        console.log(`  ${s.shop}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkPlans();
