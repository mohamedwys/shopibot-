/**
 * Manual Plan Migration Script
 *
 * Run this to manually migrate all plan codes in the database
 * Usage: npx tsx scripts/migrate-plan-codes.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting plan code migration...\n');

  // Get all widget settings
  const allSettings = await prisma.widgetSettings.findMany({
    select: {
      id: true,
      shop: true,
      plan: true
    }
  });

  console.log(`📊 Found ${allSettings.length} shops\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const setting of allSettings) {
    const oldPlan = setting.plan;
    let newPlan = oldPlan;

    // Map legacy codes to new codes
    if (oldPlan === 'BASIC') {
      newPlan = 'STARTER';
    } else if (oldPlan === 'UNLIMITED') {
      newPlan = 'PROFESSIONAL';
    } else if (oldPlan === 'BYOK') {
      newPlan = 'BYOK'; // Already correct
    } else if (oldPlan === 'STARTER' || oldPlan === 'PROFESSIONAL') {
      newPlan = oldPlan; // Already correct
    }

    if (oldPlan !== newPlan) {
      try {
        await prisma.widgetSettings.update({
          where: { id: setting.id },
          data: { plan: newPlan }
        });
        console.log(`✅ ${setting.shop}: ${oldPlan} → ${newPlan}`);
        updated++;
      } catch (error) {
        console.error(`❌ ${setting.shop}: Failed to update (${error})`);
        errors++;
      }
    } else {
      console.log(`⏭️  ${setting.shop}: ${oldPlan} (already correct)`);
      skipped++;
    }
  }

  console.log('\n📈 Migration Summary:');
  console.log(`   ✅ Updated: ${updated}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`   📊 Total: ${allSettings.length}`);

  if (updated > 0) {
    console.log('\n✨ Migration complete! Visit /app/debug-plan to verify.');
  } else {
    console.log('\n✨ No migrations needed. All plans are up to date.');
  }
}

main()
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
