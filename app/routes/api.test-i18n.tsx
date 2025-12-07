import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

/**
 * Test endpoint to verify i18n resources are loading correctly
 * Access at: /api/test-i18n
 */
export async function loader({ request }: LoaderFunctionArgs) {
  console.log('🧪 [test-i18n] Test endpoint called');

  try {
    // Try to import resources
    console.log('🔄 [test-i18n] Importing resources...');
    const { resources } = await import("../i18n/resources");
    console.log('✅ [test-i18n] Resources imported successfully');

    // Try to import i18nServer
    console.log('🔄 [test-i18n] Importing i18nServer...');
    const i18nServerModule = await import("../i18n/i18next.server");
    const i18nServer = i18nServerModule.default;
    console.log('✅ [test-i18n] i18nServer imported successfully');

    // Get locale
    console.log('🔄 [test-i18n] Getting locale...');
    const locale = await i18nServer.getLocale(request);
    console.log('✅ [test-i18n] Locale detected:', locale);

    // Check resources
    const availableLanguages = Object.keys(resources);
    const hasEnglish = 'en' in resources;
    const englishKeys = hasEnglish ? Object.keys(resources.en.common).slice(0, 5) : [];

    console.log('✅ [test-i18n] Test completed successfully');

    return json({
      success: true,
      locale,
      availableLanguages,
      hasEnglish,
      sampleEnglishKeys: englishKeys,
      resourcesType: typeof resources,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ [test-i18n] Error:', error);
    console.error('❌ [test-i18n] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack',
    });

    return json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack trace',
        name: error instanceof Error ? error.name : 'Unknown',
      },
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
