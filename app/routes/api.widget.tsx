import type { LoaderFunctionArgs } from "@remix-run/node";
import { getSecureCorsHeaders } from "../lib/cors.server";
import { rateLimit, RateLimitPresets } from "../lib/rate-limit.server";
import { RATE_LIMITS } from "../config/limits";

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
  // SECURITY: Apply rate limiting to prevent abuse
  const rateLimitResponse = rateLimit(request, {
    windowMs: RATE_LIMITS.WIDGET_RATE_WINDOW_SECONDS * 1000,
    maxRequests: RATE_LIMITS.WIDGET_REQUESTS_PER_MINUTE,
    message: 'Widget script requested too frequently. Please try again in a moment.',
  }, {
    useShop: true, // Rate limit per shop domain
    namespace: 'widget-script',
  });

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

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
  // IMPORTANT: Fallback to production URL if env var not set
  const API_BASE_URL = ${JSON.stringify(process.env.SHOPIFY_APP_URL || 'https://shopibot.vercel.app')};

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
        .ai-chat-header { position: relative; background: \${primaryColor}; color: white; padding: 24px; padding-bottom: 40px; border-radius: 16px 16px 0 0; display: flex; align-items: center; justify-content: space-between; overflow: visible; min-height: 85px; z-index: 1; box-shadow: 0 4px 20px rgba(0,0,0,0.2); }
        .ai-header-waves { position: absolute; bottom: 0; left: 0; width: 100%; height: 40px; overflow: visible; z-index: 10; pointer-events: none; }
        .ai-wave { position: absolute; bottom: 0; left: 0; width: 200%; height: 40px; background-repeat: repeat-x; background-position: 0 bottom; background-size: 50% 40px; transform-origin: center bottom; will-change: transform; }
        .ai-wave.wave-1 { animation: wave-animation-1 18s cubic-bezier(0.36, 0.45, 0.63, 0.53) infinite; opacity: 0.6; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 120' preserveAspectRatio='none'%3E%3Cpath d='M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z' fill='white'/%3E%3Cpath d='M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V0Z' fill='white'/%3E%3Cpath d='M0,0V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V0Z' fill='white'/%3E%3C/svg%3E"); }
        .ai-wave.wave-2 { animation: wave-animation-2 22s cubic-bezier(0.36, 0.45, 0.63, 0.53) infinite; opacity: 0.8; animation-delay: -7s; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 120' preserveAspectRatio='none'%3E%3Cpath d='M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z' fill='white'/%3E%3Cpath d='M0,0V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V0Z' fill='white'/%3E%3Cpath d='M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V0Z' fill='white'/%3E%3C/svg%3E"); }
        .ai-wave.wave-3 { animation: wave-animation-3 26s cubic-bezier(0.36, 0.45, 0.63, 0.53) infinite; opacity: 0.95; animation-delay: -13s; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 120' preserveAspectRatio='none'%3E%3Cpath d='M985.66,92.83C906.67,72,823.78,31,743.84,14.19c-82.26-17.34-168.06-16.33-250.45.39-57.84,11.73-114,31.07-172,41.86A600.21,600.21,0,0,1,0,27.35V120H1200V95.8C1132.19,118.92,1055.71,111.31,985.66,92.83Z' fill='white'/%3E%3Cpath d='M1200,0H0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V0Z' fill='white'/%3E%3Cpath d='M0,0V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V0Z' fill='white'/%3E%3C/svg%3E"); }
        @keyframes wave-animation-1 {
          0% { transform: translateX(0) translateZ(0) scaleY(1); }
          50% { transform: translateX(-25%) translateZ(0) scaleY(0.95); }
          100% { transform: translateX(-50%) translateZ(0) scaleY(1); }
        }
        @keyframes wave-animation-2 {
          0% { transform: translateX(0) translateZ(0) scaleY(1); }
          50% { transform: translateX(-25%) translateZ(0) scaleY(1.05); }
          100% { transform: translateX(-50%) translateZ(0) scaleY(1); }
        }
        @keyframes wave-animation-3 {
          0% { transform: translateX(0) translateZ(0) scaleY(1); }
          50% { transform: translateX(-25%) translateZ(0) scaleY(0.98); }
          100% { transform: translateX(-50%) translateZ(0) scaleY(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ai-wave { animation: none; }
        }
        .ai-chat-header h3 { margin: 0; font-size: 18px; font-weight: 600; position: relative; z-index: 2; }
        .ai-header-close { background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s; position: relative; z-index: 2; }
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
              <div class="ai-wave wave-1"></div>
              <div class="ai-wave wave-2"></div>
              <div class="ai-wave wave-3"></div>
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

  // SECURITY: Use secure CORS validation instead of wildcard
  // Only allow requests from whitelisted Shopify domains
  const corsHeaders = getSecureCorsHeaders(request);

  return new Response(widgetJavaScript, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate", // Force fresh load
      ...corsHeaders,
    },
  });
}; 