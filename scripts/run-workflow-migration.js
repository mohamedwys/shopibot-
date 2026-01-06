#!/usr/bin/env node

/**
 * Migration Script: Add workflowUsage column to ChatAnalytics
 *
 * This script adds the missing workflowUsage column to the ChatAnalytics table.
 * It's safe to run multiple times (idempotent).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runMigration() {
  console.log('🔄 Starting migration: Add workflowUsage column...');

  try {
    // Check if column exists
    const checkResult = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'ChatAnalytics'
      AND column_name = 'workflowUsage'
    `;

    if (checkResult.length > 0) {
      console.log('✅ Column workflowUsage already exists. No migration needed.');
      return;
    }

    // Add the column
    console.log('📝 Adding workflowUsage column to ChatAnalytics table...');
    await prisma.$executeRaw`
      ALTER TABLE "ChatAnalytics"
      ADD COLUMN "workflowUsage" TEXT NOT NULL DEFAULT '{}'
    `;

    console.log('✅ Migration completed successfully!');
    console.log('   Column workflowUsage has been added to ChatAnalytics table.');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration()
  .then(() => {
    console.log('\n✨ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Unexpected error:', error);
    process.exit(1);
  });
