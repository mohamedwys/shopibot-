/* global gtag, dataLayer, fbq */

// --- State ---
let chatOpen = false;
let conversationHistory = [];
let widgetSettings = null;
let currentQuickReplies = [];
let currentSentiment = 'neutral';
let currentSuggestedActions = [];
let messageQueue = [];
let isOnline = navigator.onLine;
let settingsCheckInterval = null; // kept for compatibility, even if unused now

// --- DOM Elements Cache ---
const elements = {
  container: null,
  toggleBtn: null,
  closeBtn: null,
  sendBtn: null,
  inputField: null,
  messagesContainer: null,
  chatWindow: null
};

// ======================
// Utility Functions
// ======================

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

function sanitizeUrl(url) {
  if (!url) return '';
  const urlStr = String(url).trim();
  const dangerousProtocols = /^(javascript|data|vbscript|file|about):/i;
  if (dangerousProtocols.test(urlStr)) return '';
  if (urlStr.startsWith('http://') || urlStr.startsWith('https://') || urlStr.startsWith('/')) return urlStr;
  if (!urlStr.includes(':')) return urlStr;
  return '';
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 59, g: 130, b: 246 };
}

function adjustColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, (num >> 8 & 0x00FF) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

// ======================
// Analytics
// ======================

const analyticsEvents = {
  WIDGET_OPENED: 'ai_widget_opened',
  WIDGET_CLOSED: 'ai_widget_closed',
  MESSAGE_SENT: 'ai_message_sent',
  MESSAGE_RECEIVED: 'ai_message_received',
  PRODUCT_CLICKED: 'ai_product_clicked',
  SUGGESTION_CLICKED: 'ai_suggestion_clicked',
  ERROR_OCCURRED: 'ai_error_occurred'
};

function trackAnalytics(eventName, data = {}) {
  const event = new CustomEvent('ai-widget-analytics', {
    detail: { event: eventName, timestamp: new Date().toISOString(), ...data }
  });
  window.dispatchEvent(event);

  if (typeof gtag === 'function') gtag('event', eventName, data);
  if (typeof dataLayer !== 'undefined') dataLayer.push({ event: eventName, ...data });
  if (typeof fbq === 'function') fbq('trackCustom', eventName, data);
}

// ======================
// Storage
// ======================

function loadConversationHistory() {
  try {
    const stored = localStorage.getItem('ai_chat_history');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.timestamp && (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000)) {
        conversationHistory = parsed.messages || [];
        return true;
      }
    }
  } catch (e) {}
  return false;
}

function saveConversationHistory() {
  try {
    localStorage.setItem('ai_chat_history', JSON.stringify({
      messages: conversationHistory,
      timestamp: Date.now()
    }));
  } catch (e) {}
}

function loadMessageQueue() {
  try {
    const stored = localStorage.getItem('ai_message_queue');
    if (stored) messageQueue = JSON.parse(stored);
  } catch (e) {}
}

function saveMessageQueue() {
  try {
    localStorage.setItem('ai_message_queue', JSON.stringify(messageQueue));
  } catch (e) {}
}

function processMessageQueue() {
  if (!isOnline || messageQueue.length === 0) return;
  const queue = [...messageQueue];
  messageQueue = [];
  saveMessageQueue();
  queue.forEach(queuedMessage => {
    addMessageToChat('user', `${queuedMessage.message} 📤`);
    setTimeout(() => sendMessageToServer(queuedMessage.message), 500);
  });
}

// ======================
// Network
// ======================

async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      if (response.status >= 400 && response.status < 500) throw new Error(`Request failed with status ${response.status}`);
      lastError = new Error(`Request failed with status ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) break;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  throw lastError;
}

// ======================
// DOM & UI
// ======================

function cacheDOMElements() {
  elements.container = document.getElementById('ai-sales-assistant-container');
  elements.toggleBtn = document.getElementById('ai-chat-toggle-btn');
  elements.closeBtn = document.getElementById('ai-chat-close-btn');
  elements.sendBtn = document.getElementById('ai-chat-send-btn');
  elements.inputField = document.getElementById('ai-chat-input-field');
  elements.messagesContainer = document.getElementById('ai-chat-messages');
  elements.chatWindow = document.getElementById('ai-chat-window');
}

function addMessageToChat(sender, message) {
  if (!elements.messagesContainer) return;
  const messageDiv = document.createElement('div');
  messageDiv.className = `ai-message ${sender}-message`;
  const messageContent = document.createElement('div');
  messageContent.className = 'message-content';
  const cleanMessage = message.trim();
  const lines = cleanMessage.split('\n');
  lines.forEach((line, index) => {
    const textNode = document.createTextNode(line);
    messageContent.appendChild(textNode);
    if (index < lines.length - 1) messageContent.appendChild(document.createElement('br'));
  });
  messageDiv.appendChild(messageContent);
  elements.messagesContainer.appendChild(messageDiv);
  scrollToBottom();
}

function scrollToBottom() {
  if (elements.messagesContainer) {
    elements.messagesContainer.scrollTo({ top: elements.messagesContainer.scrollHeight, behavior: 'smooth' });
  }
}

function showLoading(show) {
  let loadingDiv = document.getElementById('ai-loading');
  if (show) {
    if (loadingDiv) loadingDiv.remove();
    loadingDiv = document.createElement('div');
    loadingDiv.id = 'ai-loading';
    loadingDiv.className = 'ai-message assistant-message skeleton-message';
    for (let i = 0; i < 3; i++) {
      const line = document.createElement('div');
      line.className = 'skeleton skeleton-line';
      line.style.width = i === 2 ? '60%' : '100%';
      loadingDiv.appendChild(line);
    }
    const allMessages = elements.messagesContainer.querySelectorAll('.ai-message:not(.ai-welcome-message)');
    if (allMessages.length > 0) {
      allMessages[allMessages.length - 1].insertAdjacentElement('afterend', loadingDiv);
    } else {
      elements.messagesContainer.appendChild(loadingDiv);
    }
    scrollToBottom();
  } else if (loadingDiv) {
    loadingDiv.style.opacity = '0';
    loadingDiv.style.transition = 'opacity 0.3s ease';
    setTimeout(() => loadingDiv?.remove(), 300);
  }
}

function hideWelcomeScreen() {
  const welcome = document.querySelector('.ai-welcome-message');
  if (welcome) welcome.style.display = 'none';
}

function showNotification(message, type = 'success') {
  const existing = document.getElementById('cart-notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.id = 'cart-notification';
  notification.style.cssText = `
    position: fixed; top: 20px; right: 20px; background: ${type === 'success' ? '#10b981' : '#ef4444'};
    color: white; padding: 16px 24px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 999999; display: flex; align-items: center; gap: 12px; font-size: 14px; font-weight: 600;
    animation: slideInRight 0.3s ease;
  `;
  notification.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span><span>${message}</span>`;
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// ======================
// Business Logic
// ======================

function getProductIdFromPage() {
  // Fixed: removed unnecessary escape
  const match = window.location.pathname.match(/\/products\/([^/]+)/);
  return match ? match[1] : null;
}

async function sendMessageToServer(message) {
  showLoading(true);
  try {
    const contextData = {
      page: window.location.pathname,
      productId: getProductIdFromPage(),
      conversationHistory,
      shopDomain: widgetSettings.shopDomain,
      locale: navigator.language || 'en',
      currency: widgetSettings.currency
    };

    const response = await fetchWithRetry(`https://shopibot.vercel.app/api/widget-settings?shop=${encodeURIComponent(widgetSettings.shopDomain)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userMessage: message, products: [], context: contextData })
    });

    const data = await response.json();
    showLoading(false);

    if (data.response || data.message) {
      const responseMessage = data.response || data.message;
      addMessageToChat('assistant', responseMessage);

      if (data.recommendations?.length) displayProductRecommendations(data.recommendations);
      if (data.quickReplies?.length) displayQuickReplies(data.quickReplies);
      else displayQuickReplies([]);

      if (data.suggestedActions?.length) displaySuggestedActions(data.suggestedActions);
      else displaySuggestedActions([]);

      if (data.sentiment) {
        currentSentiment = data.sentiment;
        applySentimentStyling(data.sentiment);
      }

      if (data.requiresHumanEscalation) displayHumanEscalationPrompt();

      conversationHistory.push(
        { role: 'user', content: message },
        { role: 'assistant', content: responseMessage }
      );
      if (conversationHistory.length > 10) conversationHistory = conversationHistory.slice(-10);
      saveConversationHistory();

      trackAnalytics(analyticsEvents.MESSAGE_RECEIVED, {
        responseLength: responseMessage.length,
        hasRecommendations: !!data.recommendations?.length,
        hasSuggestions: !!data.quickReplies?.length
      });
    } else {
      addMessageToChat('assistant', 'Sorry, I encountered an error. Please try again.');
    }
  } catch (error) {
    showLoading(false);
    addMessageToChat('assistant', 'Sorry, I encountered an error. Please try again.');
    trackAnalytics(analyticsEvents.ERROR_OCCURRED, { errorMessage: error.message, errorType: error.name });
  }
}

// ======================
// Component Renderers (KEEP ALL — they use the state vars)
// ======================

function displayQuickReplies(quickReplies) { /* ... keep original ... */ }
function displaySuggestedActions(suggestedActions) { /* ... keep original ... */ }
function displayHumanEscalationPrompt() { /* ... keep original ... */ }
function applySentimentStyling(sentiment) { /* ... keep original ... */ }
function displayProductRecommendations(recommendations) { /* ... keep original ... */ }

// Cart functions
async function addToCart(productHandle, variantId, quantity = 1) { /* ... keep original ... */ }
function updateCartCount() { /* ... keep original ... */ }
function handleSuggestedAction(action) { /* ... keep original ... */ }

// ======================
// Event Handlers (defined as named functions for clarity)
// ======================

function toggleAIChat() {
  chatOpen = !chatOpen;
  trackAnalytics(chatOpen ? analyticsEvents.WIDGET_OPENED : analyticsEvents.WIDGET_CLOSED, {
    timestamp: new Date().toISOString(),
    conversationLength: conversationHistory.length
  });

  if (elements.toggleBtn) {
    elements.toggleBtn.setAttribute('aria-expanded', chatOpen.toString());
    elements.toggleBtn.setAttribute('aria-label', chatOpen ? 'Close AI chat assistant' : 'Open AI chat assistant');
  }

  if (chatOpen) {
    elements.chatWindow?.classList.add('ai-chat-open');
    setTimeout(() => elements.inputField?.focus(), 200);
    scrollToBottom();
  } else {
    elements.chatWindow?.classList.remove('ai-chat-open');
    setTimeout(() => elements.toggleBtn?.focus(), 100);
  }
}

function handleChatKeyPress(event) {
  if (event.key === 'Enter') {
    sendAIMessage();
  }
}

function sendAIMessage() {
  const message = elements.inputField?.value.trim();
  if (!message) return;

  trackAnalytics(analyticsEvents.MESSAGE_SENT, {
    messageLength: message.length,
    conversationPosition: conversationHistory.length + 1
  });

  if (!isOnline) {
    addMessageToChat('user', `${message} 📭 (Queued)`);
    messageQueue.push({ message, timestamp: Date.now() });
    saveMessageQueue();
    elements.inputField.value = '';
    showNotification('Message queued. Will send when online.', 'info');
    return;
  }

  hideWelcomeScreen();
  addMessageToChat('user', message);
  elements.inputField.value = '';
  sendMessageToServer(message);
}

// ======================
// Setup & Init
// ======================

function setupEventListeners() {
  if (elements.toggleBtn) elements.toggleBtn.addEventListener('click', toggleAIChat);
  if (elements.closeBtn) elements.closeBtn.addEventListener('click', toggleAIChat);
  if (elements.sendBtn) elements.sendBtn.addEventListener('click', sendAIMessage);
  if (elements.inputField) elements.inputField.addEventListener('keypress', handleChatKeyPress);

  // Quick action buttons
  document.querySelectorAll('.quick-action-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const prompt = e.currentTarget.dataset.prompt;
      if (prompt && elements.inputField) {
        elements.inputField.value = prompt;
        sendAIMessage();
      }
    });
  });

  // Online/offline
  window.addEventListener('online', () => {
    isOnline = true;
    showNotification('Back online! Sending queued messages...', 'success');
    processMessageQueue();
  });
  window.addEventListener('offline', () => {
    isOnline = false;
    showNotification('You\'re offline. Messages will be queued.', 'info');
  });

  // Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && chatOpen) toggleAIChat();
  });
}

function createWidget() {
  // ... (your full createWidget implementation — unchanged)
  // Make sure it uses `widgetSettings` from global scope
}

function init() {
  if (!window.aiSalesAssistantSettings) {
    console.warn('AI Sales Assistant: settings not found');
    return;
  }

  widgetSettings = window.aiSalesAssistantSettings;
  widgetSettings.shopDomain = widgetSettings.shopDomain || 'unknown.myshopify.com';
  widgetSettings.currency = widgetSettings.currency || 'USD';

  loadConversationHistory();
  loadMessageQueue();
  createWidget();
  cacheDOMElements();
  setupEventListeners();
}

// Run when ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}