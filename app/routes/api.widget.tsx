import type { LoaderFunctionArgs } from "@remix-run/node";

/**
 * Standalone AI Sales Assistant Widget Script
 *
 * This route serves a complete, self-contained chatbot widget that can be embedded
 * in any Shopify storefront using a simple script tag:
 *
 * <script src="https://your-app.com/api/widget?shop=myshop.myshopify.com"></script>
 *
 * The widget:
 * - Fetches settings from /api/widget-settings
 * - Creates a floating chat interface
 * - Handles chat interactions with the AI
 * - Is fully responsive and accessible
 * - Supports customization (colors, position, text)
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shopDomain = url.searchParams.get("shop");

  // Generate complete widget JavaScript
  const widgetJavaScript = `
/**
 * AI Sales Assistant Widget
 * Version: 2.0.0
 *
 * A complete, standalone chatbot widget for Shopify stores
 */
(function() {
  'use strict';

  // ============================================================================
  // Configuration
  // ============================================================================

  const SHOP_DOMAIN = ${JSON.stringify(shopDomain)};
  const API_BASE_URL = ${JSON.stringify(process.env.SHOPIFY_APP_URL || '')};

  // Prevent multiple instances
  if (window.aiSalesAssistantLoaded) {
    return;
  }
  window.aiSalesAssistantLoaded = true;

  // ============================================================================
  // Widget State
  // ============================================================================

  let chatOpen = false;
  let conversationHistory = [];
  let widgetSettings = null;
  let isLoading = false;
  let sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

  // ============================================================================
  // Utility Functions
  // ============================================================================

  function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function sanitizeColor(color) {
    if (!color) return '#ee5cee';
    if (/^#([0-9A-Fa-f]{3}){1,2}$/.test(color)) return color;
    return '#ee5cee';
  }

  function formatTimestamp() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  function adjustBrightness(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, Math.max(0, (num >> 16) + amt));
    const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
    const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
    return '#' + ((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1);
  }

  // ============================================================================
  // API Functions
  // ============================================================================

  async function fetchWidgetSettings() {
    try {
      const response = await fetch(
        API_BASE_URL + '/api/widget-settings?shop=' + encodeURIComponent(SHOP_DOMAIN)
      );
      const data = await response.json();
      return data.settings || getDefaultSettings();
    } catch (error) {
      return getDefaultSettings();
    }
  }

  function getDefaultSettings() {
    return {
      enabled: true,
      position: 'bottom-right',
      buttonText: 'Ask AI Assistant',
      chatTitle: 'AI Sales Assistant',
      welcomeMessage: 'Hello! How can I help you today?',
      inputPlaceholder: 'Ask me anything...',
      primaryColor: '#ee5cee'
    };
  }

  async function sendMessage(message) {
    const response = await fetch(
      API_BASE_URL + '/api/widget-settings?shop=' + encodeURIComponent(SHOP_DOMAIN),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message,
          sessionId: sessionId,
          context: {
            shopDomain: SHOP_DOMAIN,
            sessionId: sessionId,
            pageUrl: window.location.href,
            userAgent: navigator.userAgent,
            previousMessages: conversationHistory.slice(-5).map(m => m.content)
          }
        })
      }
    );

    if (!response.ok) throw new Error('Failed to send message');
    return await response.json();
  }

  // ============================================================================
  // UI Creation
  // ============================================================================

  function createWidget(settings) {
    const primaryColor = sanitizeColor(settings.primaryColor);
    const position = settings.position || 'bottom-right';

    const positionStyles = {
      'bottom-right': 'bottom: 20px; right: 20px;',
      'bottom-left': 'bottom: 20px; left: 20px;',
      'top-right': 'top: 20px; right: 20px;',
      'top-left': 'top: 20px; left: 20px;'
    };
    const posStyle = positionStyles[position] || positionStyles['bottom-right'];

    const container = document.createElement('div');
    container.id = 'ai-widget-root';
    container.innerHTML = \`
      <style>
        #ai-widget-container { position: fixed; \${posStyle} z-index: 999999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        #ai-toggle-btn { width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, \${primaryColor}, \${adjustBrightness(primaryColor, -20)}); border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; }
        #ai-toggle-btn:hover { transform: scale(1.05); box-shadow: 0 6px 16px rgba(0,0,0,0.2); }
        #ai-toggle-btn svg { width: 28px; height: 28px; fill: white; transition: transform 0.3s; }
        #ai-toggle-btn.open svg.chat { transform: rotate(180deg) scale(0); }
        #ai-toggle-btn svg.close { position: absolute; transform: rotate(180deg) scale(0); }
        #ai-toggle-btn.open svg.close { transform: rotate(0) scale(1); }
        #ai-chat-window { position: absolute; bottom: 80px; right: 0; width: 380px; max-width: calc(100vw - 40px); height: 600px; max-height: calc(100vh - 120px); background: white; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.12); display: flex; flex-direction: column; opacity: 0; transform: scale(0.95) translateY(10px); pointer-events: none; transition: all 0.3s cubic-bezier(0.4,0,0.2,1); }
        #ai-chat-window.open { opacity: 1; transform: scale(1) translateY(0); pointer-events: auto; }
        .ai-chat-header { background: linear-gradient(135deg, \${primaryColor}, \${adjustBrightness(primaryColor, -20)}); color: white; padding: 20px 20px 60px 20px; border-radius: 16px 16px 0 0; display: flex; align-items: center; justify-content: space-between; position: relative; overflow: hidden; min-height: 110px; }
        .ai-header-waves { position: absolute; bottom: 0; left: 0; width: 100%; height: 100px; pointer-events: none; z-index: 0; }
        .ai-wave { position: absolute; bottom: 0; left: 0; width: 200%; height: 100%; }
        .ai-wave path { fill: rgba(255, 255, 255, 1); }
        .ai-wave.wave-1 { animation: wave-animation-1 12s cubic-bezier(0.36, 0.45, 0.63, 0.53) infinite; opacity: 0.35; }
        .ai-wave.wave-2 { animation: wave-animation-2 15s cubic-bezier(0.36, 0.45, 0.63, 0.53) -3s infinite; opacity: 0.25; }
        .ai-wave.wave-3 { animation: wave-animation-3 18s cubic-bezier(0.36, 0.45, 0.63, 0.53) -6s infinite; opacity: 0.2; }
        @keyframes wave-animation-1 {
          0%, 100% { transform: translateX(0) translateY(0); }
          50% { transform: translateX(-25%) translateY(-8px); }
        }
        @keyframes wave-animation-2 {
          0%, 100% { transform: translateX(0) translateY(0); }
          50% { transform: translateX(-30%) translateY(-10px); }
        }
        @keyframes wave-animation-3 {
          0%, 100% { transform: translateX(0) translateY(0); }
          50% { transform: translateX(-20%) translateY(-6px); }
        }
        .ai-chat-header h3 { margin: 0; font-size: 18px; font-weight: 600; position: relative; z-index: 1; }
        .ai-header-close { background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s; position: relative; z-index: 1; }
        .ai-header-close:hover { background: rgba(255,255,255,0.3); }
        #ai-messages { flex: 1; overflow-y: auto; padding: 20px; background: #f9fafb; display: flex; flex-direction: column; gap: 12px; }
        #ai-messages::-webkit-scrollbar { width: 6px; }
        #ai-messages::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
        .ai-msg { max-width: 80%; padding: 12px 16px; border-radius: 16px; font-size: 14px; line-height: 1.5; animation: slideIn 0.3s; }
        @keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .ai-msg.user { background: \${primaryColor}; color: white; align-self: flex-end; border-bottom-right-radius: 4px; }
        .ai-msg.assistant { background: white; color: #1f2937; align-self: flex-start; border-bottom-left-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
        .ai-msg-time { font-size: 11px; opacity: 0.6; margin-top: 4px; }
        .ai-typing { display: flex; gap: 4px; padding: 12px 16px; background: white; border-radius: 16px; width: fit-content; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
        .ai-dot { width: 8px; height: 8px; border-radius: 50%; background: #9ca3af; animation: bounce 1.4s infinite; }
        .ai-dot:nth-child(2) { animation-delay: 0.2s; }
        .ai-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-10px); } }
        .ai-input-area { padding: 16px 20px; background: white; border-top: 1px solid #e5e7eb; border-radius: 0 0 16px 16px; }
        .ai-input-wrap { display: flex; gap: 8px; align-items: flex-end; }
        #ai-input { flex: 1; border: 2px solid #e5e7eb; border-radius: 12px; padding: 10px 14px; font-size: 14px; resize: none; font-family: inherit; max-height: 100px; transition: border-color 0.2s; }
        #ai-input:focus { outline: none; border-color: \${primaryColor}; }
        #ai-send { background: \${primaryColor}; color: white; border: none; width: 40px; height: 40px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        #ai-send:hover:not(:disabled) { background: \${adjustBrightness(primaryColor, -10)}; transform: scale(1.05); }
        #ai-send:disabled { opacity: 0.5; cursor: not-allowed; }
        #ai-send svg { width: 20px; height: 20px; fill: white; }
        .ai-product { background: white; border-radius: 12px; padding: 12px; margin-top: 8px; display: flex; gap: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.06); cursor: pointer; transition: all 0.2s; text-decoration: none; color: inherit; }
        .ai-product:hover { box-shadow: 0 4px 8px rgba(0,0,0,0.1); transform: translateY(-2px); }
        .ai-product img { width: 60px; height: 60px; border-radius: 8px; object-fit: cover; background: #f3f4f6; }
        .ai-product-info { flex: 1; }
        .ai-product-title { font-weight: 600; font-size: 13px; margin: 0 0 4px 0; color: #1f2937; }
        .ai-product-price { color: \${primaryColor}; font-weight: 600; font-size: 14px; }
        @media (max-width: 480px) {
          #ai-widget-container { left: 10px !important; right: 10px !important; bottom: 10px !important; }
          #ai-chat-window { width: 100%; max-width: none; height: calc(100vh - 90px); bottom: 70px; left: 0; right: 0; }
          #ai-toggle-btn { position: fixed; bottom: 10px; right: 10px; }
        }
      </style>
      <div id="ai-widget-container">
        <button id="ai-toggle-btn" aria-label="Toggle chat" aria-expanded="false">
          <svg class="chat" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.54.36 3 .97 4.29L2 22l5.71-.97C9 21.64 10.46 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.38 0-2.67-.3-3.83-.84l-.27-.13-2.83.48.48-2.83-.13-.27C4.3 14.67 4 13.38 4 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/><circle cx="8" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="16" cy="12" r="1.5"/></svg>
          <svg class="close" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
        <div id="ai-chat-window">
          <div class="ai-chat-header">
            <h3>\${escapeHTML(settings.chatTitle)}</h3>
            <button class="ai-header-close" aria-label="Close chat" onclick="window.toggleAIChat()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
            <div class="ai-header-waves">
              <svg class="ai-wave wave-1" viewBox="0 0 1200 100" preserveAspectRatio="none">
                <path d="M0,50 C200,80 400,20 600,50 C800,80 1000,20 1200,50 L1200,100 L0,100 Z"></path>
              </svg>
              <svg class="ai-wave wave-2" viewBox="0 0 1200 100" preserveAspectRatio="none">
                <path d="M0,40 C250,75 450,10 600,45 C850,75 1050,15 1200,45 L1200,100 L0,100 Z"></path>
              </svg>
              <svg class="ai-wave wave-3" viewBox="0 0 1200 100" preserveAspectRatio="none">
                <path d="M0,60 C220,85 480,30 600,60 C820,85 1080,35 1200,60 L1200,100 L0,100 Z"></path>
              </svg>
            </div>
          </div>
          <div id="ai-messages">
            <div class="ai-msg assistant">\${escapeHTML(settings.welcomeMessage)}<div class="ai-msg-time">\${formatTimestamp()}</div></div>
          </div>
          <div class="ai-input-area">
            <div class="ai-input-wrap">
              <textarea id="ai-input" placeholder="\${escapeHTML(settings.inputPlaceholder)}" rows="1" maxlength="2000"></textarea>
              <button id="ai-send" aria-label="Send" disabled><svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button>
            </div>
          </div>
        </div>
      </div>
    \`;
    document.body.appendChild(container);
  }

  // ============================================================================
  // Chat Functions
  // ============================================================================

  function toggleChat() {
    chatOpen = !chatOpen;
    const win = document.getElementById('ai-chat-window');
    const btn = document.getElementById('ai-toggle-btn');
    if (chatOpen) {
      win.classList.add('open');
      btn.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
      document.getElementById('ai-input').focus();
    } else {
      win.classList.remove('open');
      btn.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
  }

  function addMessage(content, role) {
    const msgs = document.getElementById('ai-messages');
    const div = document.createElement('div');
    div.className = 'ai-msg ' + role;
    div.innerHTML = escapeHTML(content) + '<div class="ai-msg-time">' + formatTimestamp() + '</div>';
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function addProducts(products) {
    if (!products || !products.length) return;
    const msgs = document.getElementById('ai-messages');
    products.forEach(p => {
      const a = document.createElement('a');
      a.className = 'ai-product';
      a.href = '/products/' + p.handle;
      a.target = '_blank';
      a.innerHTML = '<img src="' + escapeHTML(p.image || '') + '" alt="' + escapeHTML(p.title) + '"/><div class="ai-product-info"><p class="ai-product-title">' + escapeHTML(p.title) + '</p><p class="ai-product-price">$' + escapeHTML(p.price) + '</p></div>';
      msgs.appendChild(a);
    });
    msgs.scrollTop = msgs.scrollHeight;
  }

  function showTyping() {
    const msgs = document.getElementById('ai-messages');
    const div = document.createElement('div');
    div.id = 'ai-typing';
    div.className = 'ai-typing';
    div.innerHTML = '<div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div>';
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function hideTyping() {
    const t = document.getElementById('ai-typing');
    if (t) t.remove();
  }

  async function handleSend() {
    const input = document.getElementById('ai-input');
    const msg = input.value.trim();
    if (!msg || isLoading) return;

    addMessage(msg, 'user');
    conversationHistory.push({ role: 'user', content: msg });
    input.value = '';
    input.style.height = 'auto';
    document.getElementById('ai-send').disabled = true;

    isLoading = true;
    showTyping();

    try {
      const res = await sendMessage(msg);
      hideTyping();
      const reply = res.response || res.message || 'Sorry, something went wrong.';
      addMessage(reply, 'assistant');
      conversationHistory.push({ role: 'assistant', content: reply });
      if (res.recommendations) addProducts(res.recommendations);
    } catch (e) {
      hideTyping();
      addMessage('Sorry, I\\'m having trouble. Please try again.', 'assistant');
    } finally {
      isLoading = false;
    }
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  async function init() {
    widgetSettings = await fetchWidgetSettings();
    if (!widgetSettings.enabled) return;

    createWidget(widgetSettings);

    // Event listeners
    document.getElementById('ai-toggle-btn').addEventListener('click', toggleChat);
    document.getElementById('ai-send').addEventListener('click', handleSend);

    const input = document.getElementById('ai-input');
    input.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 100) + 'px';
      document.getElementById('ai-send').disabled = !this.value.trim() || isLoading;
    });
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (this.value.trim() && !isLoading) handleSend();
      }
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && chatOpen) toggleChat();
    });
  }

  window.toggleAIChat = toggleChat;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
`;

  return new Response(widgetJavaScript, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=60",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}; 