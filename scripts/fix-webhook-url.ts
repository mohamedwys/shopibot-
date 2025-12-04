import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixWebhookUrl() {
  try {
    console.log('🔍 Checking all stored webhook URLs...\n');

    // Find all settings
    const allSettings = await prisma.widgetSettings.findMany({
      select: {
        shop: true,
        webhookUrl: true,
      }
    });

    console.log('📊 Current webhook URLs in database:');
    allSettings.forEach(setting => {
      console.log(`  Shop: ${setting.shop}`);
      console.log(`  URL: ${setting.webhookUrl || '(null)'}`);
      console.log('');
    });

    // Clear all webhook URLs to use environment variable instead
    console.log('🧹 Clearing all webhook URLs from database...');
    const result = await prisma.widgetSettings.updateMany({
      data: {
        webhookUrl: null
      }
    });

    console.log(`✅ Cleared webhook URLs for ${result.count} shop(s)`);
    console.log('\n✨ Your app will now use the N8N_WEBHOOK_URL from Vercel environment variables');
    console.log('   Make sure N8N_WEBHOOK_URL is set to: https://dermadia.app.n8n.cloud/webhook/chat');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixWebhookUrl();
