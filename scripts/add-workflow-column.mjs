#!/usr/bin/env node

/**
 * Add workflowUsage column to ChatAnalytics table
 * Using direct PostgreSQL connection
 */

import pg from 'pg';
const { Client } = pg;

// Get database URL from environment
const DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL or DIRECT_URL environment variable not set');
  process.exit(1);
}

async function addWorkflowColumn() {
  const client = new Client({
    connectionString: DATABASE_URL,
  });

  try {
    console.log('🔄 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully');

    // Check if column exists
    console.log('\n📝 Checking if workflowUsage column exists...');
    const checkQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'ChatAnalytics'
      AND column_name = 'workflowUsage'
    `;

    const checkResult = await client.query(checkQuery);

    if (checkResult.rows.length > 0) {
      console.log('✅ Column workflowUsage already exists. No action needed.');
      return;
    }

    // Add the column
    console.log('📝 Adding workflowUsage column to ChatAnalytics table...');
    const alterQuery = `
      ALTER TABLE "ChatAnalytics"
      ADD COLUMN "workflowUsage" TEXT NOT NULL DEFAULT '{}'
    `;

    await client.query(alterQuery);
    console.log('✅ Column added successfully!');

    // Verify the column was added
    const verifyResult = await client.query(checkQuery);
    if (verifyResult.rows.length > 0) {
      console.log('✅ Verification: Column exists in database');
    } else {
      console.error('⚠️  Warning: Column was not added properly');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

addWorkflowColumn()
  .then(() => {
    console.log('\n✨ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });
