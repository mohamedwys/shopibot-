import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shopDomain = url.searchParams.get("shop");
  
  console.log('🔍 Widget route accessed:', request.url);
  console.log('🔍 Shop domain:', shopDomain);
  
  // Widget JavaScript with TTS disabler
  const widgetJavaScript = `
// 🚀 AI Sales Assistant Widget: Script starting...
console.log('🚀 AI Sales Assistant Widget: Script starting...');

// 🆕 AGGRESSIVE TTS DISABLER - Install immediately and retry if needed
function installTTSDisabler() {
  console.log('🔊 TTS DISABLER: Starting installation...');
  console.log('🔊 TTS DISABLER: window.speechSynthesis available:', !!window.speechSynthesis);
  console.log('🔊 TTS DISABLER: window.speechSynthesis.speak available:', !!(window.speechSynthesis?.speak));
  
  const originalSpeechSynthesisSpeak = window.speechSynthesis?.speak;
  if (window.speechSynthesis && originalSpeechSynthesisSpeak) {
    // 🆕 COMPLETELY DISABLE speechSynthesis.speak
    window.speechSynthesis.speak = function(utterance) {
      console.log('🔊 TTS BLOCKED: speechSynthesis.speak called but BLOCKED');
      console.trace('🔊 TTS BLOCKED: Call stack');
      console.log('🔊 TTS BLOCKED: Utterance text:', utterance.text?.substring(0, 50) + '...');
      
      // 🆕 NEVER allow TTS when Voice API is being used
      console.log('🔊 TTS BLOCKED: Voice API is being used - TTS is BLOCKED');
      return;
    };
    
    // 🆕 Also disable speechSynthesis.cancel to prevent errors
    const originalSpeechSynthesisCancel = window.speechSynthesis.cancel;
    window.speechSynthesis.cancel = function() {
      console.log('🔊 TTS CANCEL: speechSynthesis.cancel called');
      return originalSpeechSynthesisCancel.call(this);
    };
    
    console.log('🔊 TTS DISABLER: Successfully installed - ALL TTS is BLOCKED');
    return true;
  } else {
    console.log('🔊 TTS DISABLER: speechSynthesis not available, will retry...');
    return false;
  }
}

// 🆕 Install TTS disabler immediately
let ttsDisablerInstalled = installTTSDisabler();

// 🆕 If not installed, retry when DOM is ready
if (!ttsDisablerInstalled) {
  const retryTTSDisabler = () => {
    if (!ttsDisablerInstalled) {
      ttsDisablerInstalled = installTTSDisabler();
    }
  };
  
  // Retry multiple times to ensure it gets installed
  setTimeout(retryTTSDisabler, 100);
  setTimeout(retryTTSDisabler, 500);
  setTimeout(retryTTSDisabler, 1000);
}

// 🆕 CRITICAL: Also disable TTS in handleAIResponse method
const originalHandleAIResponse = window.handleAIResponse;
if (window.handleAIResponse) {
  window.handleAIResponse = function(message) {
    console.log('🔊 handleAIResponse called - Voice API enabled - browser TTS completely disabled');
    
    // 🆕 Force cancel any existing TTS to be extra safe
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
      console.log('🔊 Force cancelled any existing browser TTS');
    }
    
    // Call original function if it exists
    if (originalHandleAIResponse) {
      return originalHandleAIResponse.call(this, message);
    }
  };
}

console.log('🔊 TTS DISABLER: Widget script loaded with TTS protection');
`;

  return new Response(widgetJavaScript, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}; 