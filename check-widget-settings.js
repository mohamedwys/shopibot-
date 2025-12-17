import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkWidgetSettings() {
  console.log('🔍 Checking widget settings in database...');
  console.log('═'.repeat(70));

  try {
    const settings = await prisma.widgetSettings.findMany({
      select: {
        id: true,
        shop: true,
        enabled: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (settings.length === 0) {
      console.log('❌ NO widget settings found');
    } else {
      console.log(`✅ Found ${settings.length} widget setting(s):\n`);
      settings.forEach((s, i) => {
        console.log(`${i + 1}. Shop: ${s.shop}`);
        console.log(`   Enabled: ${s.enabled}`);
        console.log(`   Created: ${s.createdAt}`);
        console.log(`   Updated: ${s.updatedAt}`);
        console.log('');
      });
    }

    console.log('═'.repeat(70));
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkWidgetSettings();
