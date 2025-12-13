/**
 * Diagnostic script to check OpenAI and N8N configuration
 *
 * Run this to debug why your chatbot isn't using OpenAI
 * Usage: npx tsx scripts/check-openai-config.ts
 */

console.log('🔍 Checking OpenAI and N8N Configuration\n');
console.log('═'.repeat(60));

// Check environment variables
console.log('\n📋 Environment Variables:');
console.log('─'.repeat(60));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;

console.log(`OPENAI_API_KEY: ${OPENAI_API_KEY ? '✅ Set (' + OPENAI_API_KEY.substring(0, 7) + '...' + OPENAI_API_KEY.substring(OPENAI_API_KEY.length - 4) + ')' : '❌ NOT SET'}`);
console.log(`N8N_WEBHOOK_URL: ${N8N_WEBHOOK_URL ? '✅ Set (' + N8N_WEBHOOK_URL.substring(0, 30) + '...)' : '❌ NOT SET'}`);
console.log(`N8N_API_KEY: ${N8N_API_KEY ? '✅ Set' : '⚠️  NOT SET (optional)'}`);

// Check if services can initialize
console.log('\n🔧 Service Initialization:');
console.log('─'.repeat(60));

try {
  const { isEmbeddingServiceAvailable } = await import('../app/services/embedding.service');
  const available = isEmbeddingServiceAvailable();
  console.log(`Embedding Service: ${available ? '✅ Available (OpenAI key valid)' : '❌ NOT available'}`);
} catch (error: any) {
  console.log(`Embedding Service: ❌ Error - ${error.message}`);
}

try {
  const { personalizationService } = await import('../app/services/personalization.service');
  // Check if OpenAI is initialized
  const hasOpenAI = (personalizationService as any).openai !== null;
  console.log(`Personalization Service: ${hasOpenAI ? '✅ OpenAI initialized' : '❌ OpenAI NOT initialized'}`);
} catch (error: any) {
  console.log(`Personalization Service: ❌ Error - ${error.message}`);
}

// Check N8N service configuration
console.log('\n🌐 N8N Configuration:');
console.log('─'.repeat(60));

if (!N8N_WEBHOOK_URL || N8N_WEBHOOK_URL === 'MISSING_N8N_WEBHOOK_URL') {
  console.log('⚠️  N8N Webhook URL NOT configured');
  console.log('   → Chatbot will use FALLBACK processing');
  console.log('   → Fallback needs OPENAI_API_KEY to work intelligently');
} else {
  console.log('✅ N8N Webhook URL configured');
  console.log('   → Chatbot will try N8N first');
  console.log('   → Falls back to OpenAI if N8N fails');
}

// Determine current behavior
console.log('\n🤖 Expected Chatbot Behavior:');
console.log('─'.repeat(60));

if (!OPENAI_API_KEY && (!N8N_WEBHOOK_URL || N8N_WEBHOOK_URL === 'MISSING_N8N_WEBHOOK_URL')) {
  console.log('❌ CRITICAL: No AI configured!');
  console.log('   → Using simple keyword-based responses only');
  console.log('   → No semantic search, no intent detection');
  console.log('\n💡 FIX: Set OPENAI_API_KEY in your environment');
} else if (OPENAI_API_KEY && (!N8N_WEBHOOK_URL || N8N_WEBHOOK_URL === 'MISSING_N8N_WEBHOOK_URL')) {
  console.log('✅ Using OpenAI-powered fallback');
  console.log('   → Semantic search enabled');
  console.log('   → Intent classification enabled');
  console.log('   → Sentiment analysis enabled');
  console.log('\n💡 OPTIONAL: Set N8N_WEBHOOK_URL for advanced workflows');
} else if (!OPENAI_API_KEY && N8N_WEBHOOK_URL) {
  console.log('⚠️  Using N8N only (no local AI fallback)');
  console.log('   → If N8N fails, uses simple keyword matching');
  console.log('\n💡 RECOMMEND: Set OPENAI_API_KEY for better fallback');
} else {
  console.log('✅ OPTIMAL: Both N8N and OpenAI configured');
  console.log('   → N8N for primary processing');
  console.log('   → OpenAI-powered fallback if N8N fails');
}

// Test OpenAI connection if key is set
if (OPENAI_API_KEY) {
  console.log('\n🧪 Testing OpenAI Connection:');
  console.log('─'.repeat(60));

  try {
    const { OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    console.log('Sending test request to OpenAI...');
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say "OK" if you can read this' }],
      max_tokens: 10,
    });

    const reply = response.choices[0]?.message.content || '';
    console.log(`✅ OpenAI responded: "${reply}"`);
    console.log('✅ OpenAI connection is WORKING!');
  } catch (error: any) {
    console.log(`❌ OpenAI test FAILED: ${error.message}`);
    if (error.code === 'invalid_api_key') {
      console.log('   → API key is INVALID');
    } else if (error.code === 'insufficient_quota') {
      console.log('   → API key has NO QUOTA (no credits)');
    }
  }
}

// Recommendations
console.log('\n📝 Recommendations:');
console.log('═'.repeat(60));

const recommendations: string[] = [];

if (!OPENAI_API_KEY) {
  recommendations.push('❗ Add OPENAI_API_KEY to your .env file');
  recommendations.push('   Get key from: https://platform.openai.com/api-keys');
}

if (!N8N_WEBHOOK_URL || N8N_WEBHOOK_URL === 'MISSING_N8N_WEBHOOK_URL') {
  recommendations.push('⚠️  Consider setting up N8N for advanced workflows');
  recommendations.push('   Or keep using OpenAI fallback (works great!)');
}

if (recommendations.length === 0) {
  console.log('✅ Configuration looks good!');
} else {
  recommendations.forEach(rec => console.log(rec));
}

console.log('\n' + '═'.repeat(60));
console.log('✨ Diagnostic complete!\n');
