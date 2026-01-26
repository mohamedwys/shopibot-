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
let translations = null; // Store loaded translations
let currentChatSessionId = null; // Track current chat session for rating
let conversationId = null; // Unique ID per conversation for rating tracking (resets on chat open)

// Track page load time for welcome popup timing
const pageLoadTime = Date.now();

// ✅ FIX: Persist sessionId in localStorage to prevent repeated greetings
// Try to retrieve existing sessionId from localStorage, or create a new one
let sessionId = null;
try {
  sessionId = localStorage.getItem('ai_assistant_session_id');
  if (!sessionId) {
    sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('ai_assistant_session_id', sessionId);
  }
} catch (e) {
  // If localStorage is not available (privacy mode), use a session-scoped ID
  sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

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
// Translation Functions
// ======================

async function loadTranslations(lang) {
  try {
    const response = await fetch(`https://shopibot.vercel.app/api/chatbot-translations?lang=${lang}`);
    if (!response.ok) throw new Error('Failed to load translations');
    const data = await response.json();
    translations = data.translations;
    return translations;
  } catch (error) {
    console.error('Failed to load translations:', error);
    // Fallback to English defaults
    translations = {
      online: 'Online',
      offline: 'Offline',
      close: 'Close',
      thinking: 'Thinking',
      poweredByAI: 'Powered by AI',
      inputPlaceholder: 'Ask me anything about our products...',
      bestSellers: 'Best Sellers',
      newArrivals: 'New Arrivals',
      onSale: 'On Sale',
      recommended: 'Recommended',
      shipping: 'Shipping',
      returns: 'Returns',
      trackOrder: 'Track Order',
      help: 'Help',
      discover: 'Discover',
      support: 'Support',
      shippingPrompt: 'Tell me about shipping and delivery',
      returnsPrompt: 'What is your return policy?',
      trackOrderPrompt: 'How can I track my order?',
      bestSellersPrompt: 'Show me your popular products',
      newArrivalsPrompt: 'Show me new arrivals',
      onSalePrompt: 'What products are on sale?',
      recommendedPrompt: 'Show me recommendations for me',
      typeYourQuestion: 'Type your question below to get started'
    };
    return translations;
  }
}

function t(key) {
  return (translations && translations[key]) || key;
}

// ======================
// Utility Functions
// ======================

function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Icon helper functions for professional SVG icons
function getIconSVG(iconName, size = 20) {
  const icons = {
    shoppingBag: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>`,
    user: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
    headphones: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>`,
    sparkles: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z"></path></svg>`,
    lightbulb: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"></path><path d="M9 18h6"></path><path d="M10 22h4"></path></svg>`,
    helpCircle: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
    messageCircle: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>`,
    store: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`,
    package: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`,
    search: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>`,
  };
  return icons[iconName] || icons.helpCircle;
}

function detectQuickReplyIcon(replyText) {
  const text = replyText.toLowerCase();

  // Product/shopping related
  if (text.includes('product') || text.includes('browse') || text.includes('shop') || text.includes('produit') || text.includes('parcourir')) {
    return 'shoppingBag';
  }
  // Support/help related
  if (text.includes('person') || text.includes('support') || text.includes('help') || text.includes('personne') || text.includes('aide') || text.includes('contact')) {
    return 'headphones';
  }
  // New/more/else related
  if (text.includes('else') || text.includes('more') || text.includes('autre') || text.includes('new') || text.includes('arrivals') || text.includes('nouveau')) {
    return 'sparkles';
  }
  // Category related
  if (text.includes('categor') || text.includes('catégor') || text.includes('view')) {
    return 'package';
  }
  // Search related
  if (text.includes('search') || text.includes('find') || text.includes('cherch') || text.includes('recherch')) {
    return 'search';
  }
  // Store/shop related
  if (text.includes('store') || text.includes('shop') || text.includes('boutique')) {
    return 'store';
  }
  // Default
  return 'messageCircle';
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
      if (parsed.timestamp && (Date.now() - parsed.timestamp < 86400000)) {
        conversationHistory = parsed.messages || [];
      }
    }
  } catch (e) {}
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
// UI Helpers
// ======================

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

// ======================
// Rating Modal Popup
// ======================

function shouldShowRatingPopup() {
  // Check if rating is enabled in settings
  if (widgetSettings && widgetSettings.ratingEnabled === false) {
    console.log('[Rating Debug] Rating disabled in settings');
    return false;
  }

  // Check if this specific conversation has already been rated
  try {
    const ratedConversations = JSON.parse(sessionStorage.getItem('ai_rated_conversations') || '[]');
    const currentConversationId = conversationId || 'no-conversation-id';
    const hasMinMessages = conversationHistory.length >= 4;
    const notRated = !ratedConversations.includes(currentConversationId);

    console.log('[Rating Debug] Popup check:', {
      conversationLength: conversationHistory.length,
      hasMinMessages,
      conversationId: currentConversationId,
      ratedConversations,
      notRated,
      shouldShow: notRated && hasMinMessages
    });

    return notRated && hasMinMessages;
  } catch (e) {
    console.log('[Rating Debug] SessionStorage error, checking messages only:', conversationHistory.length);
    // Fallback if sessionStorage unavailable
    return conversationHistory.length >= 4;
  }
}

function showRatingModal() {
  if (!shouldShowRatingPopup()) return;

  // Mark as shown in sessionStorage
  try {
    sessionStorage.setItem('ai_rating_shown', 'true');
  } catch (e) {
    // Ignore if sessionStorage unavailable
  }

  // Create modal overlay - softer blur matching welcome popup
  const overlay = document.createElement('div');
  overlay.id = 'ai-rating-modal-overlay';
  overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.3); display: flex; align-items: center; justify-content: center; z-index: 999999; backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'rating-modal-title');

  // Create modal popup - matching welcome popup visual language
  const modal = document.createElement('div');
  modal.id = 'ai-rating-modal';
  modal.style.cssText = 'background: #ffffff; border-radius: 12px; padding: 24px 20px 20px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12), 0 1px 4px rgba(0, 0, 0, 0.08); max-width: 340px; width: calc(100% - 48px); box-sizing: border-box; position: relative; border: 1px solid rgba(0, 0, 0, 0.08);';
  modal.setAttribute('tabindex', '-1');

  // Icon at the top - subtle and centered (matching welcome popup style)
  const iconDiv = document.createElement('div');
  iconDiv.style.cssText = 'display: flex; align-items: center; justify-content: center; margin-bottom: 16px;';
  iconDiv.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>';
  modal.appendChild(iconDiv);

  // Title - more compact, matching welcome popup typography
  const title = document.createElement('h2');
  title.id = 'rating-modal-title';
  title.textContent = (widgetSettings && widgetSettings.ratingCustomTitle)
    ? widgetSettings.ratingCustomTitle
    : t('ratingTitle');
  title.style.cssText = 'margin: 0 0 20px 0; font-size: 17px; font-weight: 500; color: #1f2937; text-align: center; line-height: 1.4; letter-spacing: -0.01em;';
  modal.appendChild(title);

  // Stars container - smaller, softer, secondary to buttons
  const starsContainer = document.createElement('div');
  starsContainer.style.cssText = 'display: flex; gap: 4px; justify-content: center; align-items: center; margin-bottom: 20px;';
  starsContainer.setAttribute('role', 'radiogroup');
  starsContainer.setAttribute('aria-label', 'Rate your experience from 1 to 5 stars');

  // SVG star helper - smaller and softer
  const starSVG = (filled) => `<svg width="28" height="28" viewBox="0 0 24 24" fill="${filled ? '#FBBF24' : 'none'}" stroke="${filled ? '#F59E0B' : '#D1D5DB'}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="pointer-events: none; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;

  let selectedRating = 0;
  let isSubmitting = false;

  // Create 5 stars
  for (let i = 1; i <= 5; i++) {
    const starBtn = document.createElement('button');
    starBtn.innerHTML = starSVG(false);
    starBtn.style.cssText = 'background: transparent; border: none; cursor: pointer; padding: 4px; transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s ease; flex-shrink: 0; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 8px;';
    starBtn.setAttribute('aria-label', t('ratingAriaLabel').replace('{{stars}}', i));
    starBtn.setAttribute('role', 'radio');
    starBtn.setAttribute('aria-checked', 'false');
    starBtn.dataset.rating = i;
    starBtn.type = 'button';

    // Hover effect - only scale the current star
    starBtn.addEventListener('mouseenter', function() {
      if (isSubmitting) return;
      const rating = parseInt(this.dataset.rating);
      this.style.transform = 'scale(1.1)';
      this.style.backgroundColor = 'rgba(251, 191, 36, 0.1)';
      for (let j = 1; j <= 5; j++) {
        const btn = starsContainer.children[j - 1];
        btn.innerHTML = j <= rating ? starSVG(true) : starSVG(false);
      }
    });

    starBtn.addEventListener('mouseleave', function() {
      if (isSubmitting) return;
      this.style.transform = 'scale(1)';
      this.style.backgroundColor = 'transparent';
    });

    starsContainer.addEventListener('mouseleave', function() {
      if (isSubmitting) return;
      for (let j = 1; j <= 5; j++) {
        const btn = starsContainer.children[j - 1];
        btn.innerHTML = j <= selectedRating ? starSVG(true) : starSVG(false);
      }
    });

    // Click handler - only select, don't submit
    starBtn.addEventListener('click', function() {
      if (isSubmitting) return;
      selectedRating = parseInt(this.dataset.rating);

      // Update ARIA and visual state
      for (let j = 1; j <= 5; j++) {
        const btn = starsContainer.children[j - 1];
        btn.innerHTML = j <= selectedRating ? starSVG(true) : starSVG(false);
        btn.setAttribute('aria-checked', j <= selectedRating ? 'true' : 'false');
      }

      // Enable submit button
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
      }
    });

    starsContainer.appendChild(starBtn);
  }

  modal.appendChild(starsContainer);

  // Buttons container
  const buttonsContainer = document.createElement('div');
  buttonsContainer.style.cssText = 'display: flex; gap: 8px; flex-direction: column;';

  // Submit button (primary action) - matching welcome popup button style
  const submitBtn = document.createElement('button');
  submitBtn.textContent = 'Submit';
  submitBtn.disabled = true;
  submitBtn.style.cssText = `background: ${widgetSettings.primaryColor || '#3b82f6'}; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 15px; font-weight: 500; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); opacity: 0.5; width: 100%;`;
  submitBtn.setAttribute('aria-label', 'Submit rating');
  submitBtn.type = 'button';

  submitBtn.addEventListener('click', async function() {
    if (isSubmitting || selectedRating === 0) return;
    isSubmitting = true;

    // Disable all interactive elements
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.7';
    maybeLaterBtn.disabled = true;
    maybeLaterBtn.style.opacity = '0.7';
    for (let j = 1; j <= 5; j++) {
      const btn = starsContainer.children[j - 1];
      btn.disabled = true;
      btn.style.cursor = 'default';
    }

    // Submit rating
    await submitRatingToBackend(selectedRating, overlay);
  });

  submitBtn.addEventListener('mouseenter', function() {
    if (!this.disabled) {
      this.style.transform = 'translateY(-1px)';
      this.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    }
  });

  submitBtn.addEventListener('mouseleave', function() {
    if (!this.disabled) {
      this.style.transform = 'translateY(0)';
      this.style.boxShadow = 'none';
    }
  });

  buttonsContainer.appendChild(submitBtn);

  // Maybe later button (secondary action) - subtle style
  const maybeLaterBtn = document.createElement('button');
  maybeLaterBtn.textContent = 'Maybe later';
  maybeLaterBtn.style.cssText = 'background: transparent; color: #6b7280; border: none; padding: 8px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); width: 100%;';
  maybeLaterBtn.setAttribute('aria-label', 'Close rating modal');
  maybeLaterBtn.type = 'button';

  maybeLaterBtn.addEventListener('click', function() {
    if (!isSubmitting) {
      closeRatingModal(overlay);
    }
  });

  maybeLaterBtn.addEventListener('mouseenter', function() {
    if (!this.disabled) {
      this.style.backgroundColor = '#f3f4f6';
      this.style.color = '#1f2937';
    }
  });

  maybeLaterBtn.addEventListener('mouseleave', function() {
    if (!this.disabled) {
      this.style.backgroundColor = 'transparent';
      this.style.color = '#6b7280';
    }
  });

  buttonsContainer.appendChild(maybeLaterBtn);
  modal.appendChild(buttonsContainer);
  overlay.appendChild(modal);

  // Add to body (outside chat container)
  document.body.appendChild(overlay);

  // Fade in + slide up animation (matching welcome popup)
  overlay.style.opacity = '0';
  modal.style.transform = 'translateY(10px)';
  requestAnimationFrame(() => {
    overlay.style.transition = 'opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
    modal.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
    overlay.style.opacity = '1';
    modal.style.transform = 'translateY(0)';
  });

  // Focus management and keyboard navigation
  setTimeout(() => {
    modal.focus();
    const firstStar = starsContainer.querySelector('button');
    if (firstStar) firstStar.focus();
  }, 100);

  // Keyboard navigation for stars (arrow keys)
  starsContainer.addEventListener('keydown', function(e) {
    if (isSubmitting) return;
    const stars = Array.from(starsContainer.querySelectorAll('button'));
    const currentIndex = stars.indexOf(document.activeElement);

    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      const nextIndex = Math.min(currentIndex + 1, stars.length - 1);
      stars[nextIndex].focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      const prevIndex = Math.max(currentIndex - 1, 0);
      stars[prevIndex].focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      stars[currentIndex].click();
    } else if (e.key === 'Escape' && !isSubmitting) {
      closeRatingModal(overlay);
    }
  });

  // Focus trap - keep focus within modal
  overlay.addEventListener('keydown', function(e) {
    if (e.key === 'Tab') {
      const focusableElements = modal.querySelectorAll('button:not([disabled])');
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    } else if (e.key === 'Escape' && !isSubmitting) {
      closeRatingModal(overlay);
    }
  });

  // Close on overlay click
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay && !isSubmitting) {
      closeRatingModal(overlay);
    }
  });
}

async function submitRatingToBackend(rating, overlay) {
  try {
    const chatSessionId = currentChatSessionId || sessionId;
    const response = await fetch('https://shopibot.vercel.app/api/submit-rating', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shop: widgetSettings.shopDomain,
        chatSessionId: chatSessionId,
        rating: rating
      })
    });

    const data = await response.json();

    if (data.success) {
      showSuccessConfirmation(overlay);
    } else {
      console.error('Rating submission failed:', data.error);
      closeRatingModal(overlay);
    }
  } catch (error) {
    console.error('Error submitting rating:', error);
    closeRatingModal(overlay);
  }
}

function showSuccessConfirmation(overlay) {
  const modal = overlay.querySelector('#ai-rating-modal');
  if (!modal) return;

  // ✅ Mark this conversation as rated in sessionStorage
  try {
    const ratedConversations = JSON.parse(sessionStorage.getItem('ai_rated_conversations') || '[]');
    const currentConversationId = conversationId || 'no-conversation-id';
    if (!ratedConversations.includes(currentConversationId)) {
      ratedConversations.push(currentConversationId);
      sessionStorage.setItem('ai_rated_conversations', JSON.stringify(ratedConversations));
      console.log('[Rating Debug] Marked conversation as rated:', currentConversationId);
    }
  } catch (e) {
    console.warn('Could not mark conversation as rated:', e);
  }

  // Replace content with success message - matching welcome popup style
  modal.innerHTML = '';
  modal.style.cssText = 'background: #ffffff; border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 12px; padding: 24px 20px 20px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12), 0 1px 4px rgba(0, 0, 0, 0.08); max-width: 340px; width: calc(100% - 48px); box-sizing: border-box;';

  // Success icon - smaller, more subtle, matching the modal icon style
  const icon = document.createElement('div');
  icon.innerHTML = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto 16px; display: block;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
  modal.appendChild(icon);

  // Thank you message - use custom text if provided, otherwise use translation
  const message = document.createElement('div');
  message.textContent = (widgetSettings && widgetSettings.ratingCustomThankYou)
    ? widgetSettings.ratingCustomThankYou
    : t('ratingThankYou');
  message.style.cssText = 'font-size: 15px; font-weight: 500; color: #065f46; text-align: center; line-height: 1.5;';
  modal.appendChild(message);

  // Auto-close after 2 seconds
  setTimeout(() => {
    closeRatingModal(overlay);
  }, 2000);
}

function closeRatingModal(overlay) {
  if (!overlay) return;
  overlay.style.transition = 'opacity 0.2s cubic-bezier(0.4, 0, 1, 1)';
  overlay.style.opacity = '0';
  const modal = overlay.querySelector('#ai-rating-modal');
  if (modal) {
    modal.style.transition = 'transform 0.2s cubic-bezier(0.4, 0, 1, 1)';
    modal.style.transform = 'translateY(10px) scale(0.95)';
  }
  setTimeout(() => {
    if (overlay.parentNode) {
      overlay.remove();
    }
  }, 250);
}

// ======================
// Welcome Popup
// ======================

function shouldShowWelcomePopup() {
  // Check if welcome popup is enabled (default: true)
  if (widgetSettings && widgetSettings.welcomePopupEnabled === false) {
    console.log('[Welcome Popup] Disabled in settings');
    return false;
  }

  // Never show if chat has been opened already this session
  try {
    if (sessionStorage.getItem('ai_chat_opened')) {
      console.log('[Welcome Popup] Chat already opened this session');
      return false;
    }
  } catch (e) {
    // Ignore if sessionStorage unavailable
  }

  // Never show if welcome popup was already shown this session
  try {
    if (sessionStorage.getItem('ai_welcome_shown')) {
      console.log('[Welcome Popup] Already shown this session');
      return false;
    }
  } catch (e) {
    // Ignore if sessionStorage unavailable
  }

  console.log('[Welcome Popup] All conditions passed - should show');
  return true;
}

function showWelcomePopup() {
  if (!shouldShowWelcomePopup()) {
    console.log('[Welcome Popup] Not showing - conditions not met');
    return;
  }

  // Get the chat toggle button position to position popup near it
  const toggleBtn = elements.toggleBtn;
  if (!toggleBtn) {
    console.warn('[Welcome Popup] Cannot show - toggle button not found. Elements:', elements);
    return;
  }

  console.log('[Welcome Popup] Showing popup');

  // Mark as shown in sessionStorage
  try {
    sessionStorage.setItem('ai_welcome_shown', 'true');
  } catch (e) {
    console.warn('[Welcome Popup] Could not set sessionStorage:', e);
  }

  // Create popup container
  const popup = document.createElement('div');
  popup.id = 'ai-welcome-popup';
  popup.setAttribute('role', 'button');
  popup.setAttribute('aria-label', (widgetSettings && widgetSettings.welcomePopupMessage)
    ? widgetSettings.welcomePopupMessage
    : t('welcomeMessage'));
  popup.setAttribute('tabindex', '0');

  // Get position configuration
  const position = widgetSettings?.position || 'bottom-right';
  const isLeft = position.includes('left');
  const isBottom = position.includes('bottom');

  // Style the popup - positioned near the chat launcher
  popup.style.cssText = `
    position: fixed;
    ${isBottom ? 'bottom' : 'top'}: ${isBottom ? '100px' : '100px'};
    ${isLeft ? 'left' : 'right'}: 24px;
    background: #ffffff;
    color: #1f2937;
    padding: 14px 18px;
    border-radius: 12px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12), 0 1px 4px rgba(0, 0, 0, 0.08);
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    z-index: 999998;
    max-width: 280px;
    line-height: 1.4;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    opacity: 0;
    transform: translateY(10px);
    border: 1px solid rgba(0, 0, 0, 0.08);
  `;

  // Add close button
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '&times;';
  closeBtn.style.cssText = `
    background: transparent;
    border: none;
    color: #9ca3af;
    font-size: 20px;
    font-weight: 400;
    cursor: pointer;
    padding: 0;
    margin-left: auto;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    line-height: 1;
    transition: color 0.2s ease;
  `;
  closeBtn.setAttribute('aria-label', t('close'));
  closeBtn.setAttribute('tabindex', '0');

  closeBtn.addEventListener('mouseenter', () => {
    closeBtn.style.color = '#1f2937';
  });

  closeBtn.addEventListener('mouseleave', () => {
    closeBtn.style.color = '#9ca3af';
  });

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeWelcomePopup(popup);
  });

  // Add message text - use custom message if provided, otherwise use translation
  const messageSpan = document.createElement('span');
  messageSpan.textContent = (widgetSettings && widgetSettings.welcomePopupMessage)
    ? widgetSettings.welcomePopupMessage
    : t('welcomeMessage');
  messageSpan.style.cssText = 'flex: 1;';

  popup.appendChild(messageSpan);
  popup.appendChild(closeBtn);

  // Hover effect
  popup.addEventListener('mouseenter', () => {
    popup.style.transform = 'translateY(0) scale(1.02)';
    popup.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.15), 0 2px 6px rgba(0, 0, 0, 0.1)';
  });

  popup.addEventListener('mouseleave', () => {
    popup.style.transform = 'translateY(0) scale(1)';
    popup.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.12), 0 1px 4px rgba(0, 0, 0, 0.08)';
  });

  // Click handler - open chat and dismiss popup
  popup.addEventListener('click', () => {
    closeWelcomePopup(popup);
    if (!chatOpen) {
      toggleAIChat();
    }
  });

  // Keyboard support
  popup.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      popup.click();
    } else if (e.key === 'Escape') {
      closeWelcomePopup(popup);
    }
  });

  closeBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      closeWelcomePopup(popup);
    }
  });

  // Add to body
  document.body.appendChild(popup);

  // Animate in
  requestAnimationFrame(() => {
    popup.style.opacity = '1';
    popup.style.transform = 'translateY(0)';
  });

  // Auto-dismiss after 10 seconds
  setTimeout(() => {
    if (popup.parentNode) {
      closeWelcomePopup(popup);
    }
  }, 10000);
}

function closeWelcomePopup(popup) {
  if (!popup || !popup.parentNode) return;
  popup.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 1, 1)';
  popup.style.opacity = '0';
  popup.style.transform = 'translateY(10px) scale(0.95)';
  setTimeout(() => {
    if (popup.parentNode) {
      popup.remove();
    }
  }, 250);
}

function initWelcomePopup() {
  // Calculate time elapsed since page load
  const timeElapsed = Date.now() - pageLoadTime;
  const targetDelay = 3000; // 3 seconds after page load

  // Calculate remaining delay to ensure popup shows 3 seconds from page load
  const remainingDelay = Math.max(0, targetDelay - timeElapsed);

  console.log('[Welcome Popup] Initializing - Time since page load:', timeElapsed + 'ms', '| Remaining delay:', remainingDelay + 'ms');

  setTimeout(() => {
    showWelcomePopup();
  }, remainingDelay);
}

function showLoading(show) {
  let loadingDiv = document.getElementById('ai-loading');

  if (show) {
    if (loadingDiv) loadingDiv.remove();

    // Inject keyframes if not present
    if (!document.getElementById('bounce-keyframes') && document.head) {
      const style = document.createElement('style');
      style.id = 'bounce-keyframes';
      style.textContent = '@keyframes bounce{0%,60%,100%{transform:translateY(0) scale(1);opacity:.7}30%{transform:translateY(-12px) scale(1.2);opacity:1}}';
      document.head.appendChild(style);
    }

    loadingDiv = document.createElement('div');
    loadingDiv.id = 'ai-loading';
    loadingDiv.className = 'ai-message assistant-message';
    loadingDiv.setAttribute('role', 'status');
    loadingDiv.setAttribute('aria-label', t('thinking'));
    loadingDiv.setAttribute('aria-live', 'polite');
    loadingDiv.style.cssText = 'display:flex;align-items:center;justify-content:center;padding:16px 20px;background:white;border-radius:12px;border:1px solid #f3f4f6;box-shadow:0 2px 8px rgba(0,0,0,0.08);margin-bottom:16px;max-width:fit-content;align-self:flex-start;margin-left:12px;gap:8px;';

    const primaryColor = widgetSettings.primaryColor || '#3b82f6';

    // Create 3 dots with explicit animation properties
    [0, 0.2, 0.4].forEach((delay, index) => {
      const dot = document.createElement('div');
      dot.className = 'ai-loading-dot';

      // Set base styles
      dot.style.width = '10px';
      dot.style.height = '10px';
      dot.style.background = primaryColor;
      dot.style.borderRadius = '50%';
      dot.style.display = 'inline-block';

      // Apply animation (same approach that works in console)
      dot.style.animationName = 'bounce';
      dot.style.animationDuration = '1.4s';
      dot.style.animationTimingFunction = 'ease-in-out';
      dot.style.animationIterationCount = 'infinite';
      dot.style.animationDelay = `${index * 0.2}s`;

      loadingDiv.appendChild(dot);
    });

    elements.messagesContainer.appendChild(loadingDiv);
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
  if (document.body) document.body.appendChild(notification);
  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// ======================
// Business Logic
// ======================

function getProductIdFromPage() {
  const match = window.location.pathname.match(/\/products\/([^/]+)/);
  return match ? match[1] : null;
}

async function sendMessageToServer(message) {
  showLoading(true);
  try {
    const contextData = {
      sessionId: sessionId, // ✅ FIX: Include sessionId to maintain conversation
      page: window.location.pathname,
      productId: getProductIdFromPage(),
      conversationHistory,
      shopDomain: widgetSettings.shopDomain,
      locale: navigator.language || 'en',
      currency: widgetSettings.currency
    };

    // ✅ CORRECT - Public API endpoint
    const url = `https://shopibot.vercel.app/api/widget-settings?shop=${encodeURIComponent(widgetSettings.shopDomain)}`;
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userMessage: message, products: [], context: contextData })
    });

    const data = await response.json();
    showLoading(false);

    if (data.response || data.message) {
      const responseMessage = data.response || data.message;
      addMessageToChat('assistant', responseMessage);

      // ✅ FIX: Capture chatSessionId for rating tracking
      if (data.chatSessionId) {
        currentChatSessionId = data.chatSessionId;
      }

      // Show product recommendations when backend sends them
      // Backend already filters when to send recommendations
      if (data.recommendations?.length) {
        displayProductRecommendations(data.recommendations);
      }

      // Quick replies removed - no longer displaying quick action buttons

      if (data.suggestedActions?.length) displaySuggestedActions(data.suggestedActions);
      else displaySuggestedActions([]);

      if (data.sentiment) {
        applySentimentStyling(data.sentiment);
      }

      if (data.requiresHumanEscalation) displayHumanEscalationPrompt();

      conversationHistory.push(
        { role: 'user', content: message },
        { role: 'assistant', content: responseMessage }
      );
      if (conversationHistory.length > 10) conversationHistory = conversationHistory.slice(-10);
      console.log('[Rating Debug] Conversation updated, length:', conversationHistory.length);
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
// Component Renderers
// ======================

function displayQuickReplies(quickReplies) {
  if (!quickReplies || quickReplies.length === 0) {
    const container = document.getElementById('quick-replies-container');
    if (container) container.remove();
    return;
  }
  const existingContainer = document.getElementById('quick-replies-container');
  if (existingContainer) existingContainer.remove();
  const container = document.createElement('div');
  container.id = 'quick-replies-container';
  container.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 12px 16px;
    background: linear-gradient(to bottom, #f9fafb, #ffffff);
    border-top: 1px solid #e5e7eb;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  `;
  quickReplies.forEach(reply => {
    const button = document.createElement('button');
    button.className = 'quick-reply-btn';
    button.setAttribute('title', reply); // Tooltip on hover
    button.setAttribute('aria-label', reply);

    // Detect appropriate icon for this reply
    const iconName = detectQuickReplyIcon(reply);
    const iconSVG = getIconSVG(iconName, 18);

    // Create button content with icon and text
    const iconSpan = document.createElement('span');
    iconSpan.innerHTML = iconSVG;
    iconSpan.style.cssText = `
      display: inline-flex;
      align-items: center;
      margin-right: 6px;
      flex-shrink: 0;
    `;

    const textSpan = document.createElement('span');
    textSpan.textContent = reply;
    textSpan.style.cssText = `
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 150px;
    `;

    button.appendChild(iconSpan);
    button.appendChild(textSpan);

    button.style.cssText = `
      background: white;
      border: 1.5px solid ${widgetSettings.primaryColor || '#ee5cee'};
      color: ${widgetSettings.primaryColor || '#ee5cee'};
      padding: 8px 14px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      max-width: 220px;
    `;
    button.onmouseover = () => {
      button.style.background = widgetSettings.primaryColor || '#ee5cee';
      button.style.color = 'white';
      button.style.transform = 'translateY(-1px)';
      button.style.boxShadow = '0 3px 10px rgba(0,0,0,0.15)';
    };
    button.onmouseout = () => {
      button.style.background = 'white';
      button.style.color = widgetSettings.primaryColor || '#ee5cee';
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = 'none';
    };
    button.onclick = () => {
      trackAnalytics(analyticsEvents.SUGGESTION_CLICKED, { suggestion: reply });
      const inputField = document.getElementById('ai-chat-input-field');
      if (inputField) {
        inputField.value = reply;
        sendAIMessage();
      }
    };
    container.appendChild(button);
  });
  const chatFooter = document.querySelector('.ai-chat-footer') ||
                     document.getElementById('ai-chat-input-field')?.parentElement;
  if (chatFooter) {
    chatFooter.insertBefore(container, chatFooter.firstChild);
  }
}

function displaySuggestedActions(suggestedActions) {
  if (!suggestedActions || suggestedActions.length === 0) {
    const existingBar = document.getElementById('suggested-actions-bar');
    if (existingBar) existingBar.remove();
    return;
  }
  const existingBar = document.getElementById('suggested-actions-bar');
  if (existingBar) existingBar.remove();
  const actionsBar = document.createElement('div');
  actionsBar.id = 'suggested-actions-bar';
  actionsBar.style.cssText = `
    display: flex;
    gap: 10px;
    padding: 16px;
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    border-radius: 12px;
    margin: 12px 0;
    flex-wrap: wrap;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  `;
  suggestedActions.forEach(action => {
    const button = document.createElement('button');
    button.textContent = action.label;
    button.className = 'suggested-action-btn';
    const icons = {
      'view_product': '👁️',
      'add_to_cart': '🛒',
      'compare': '⚖️',
      'custom': '✨'
    };
    const icon = icons[action.action] || '▶️';
    button.style.cssText = `
      background: ${widgetSettings.primaryColor || '#ee5cee'};
      color: white;
      border: none;
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 17px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.3s ease;
      box-shadow: 0 2px 6px rgba(0,0,0,0.12);
      flex: 1;
      min-width: 140px;
      justify-content: center;
    `;
    button.innerHTML = `<span style="font-size: 16px;">${icon}</span> ${escapeHTML(action.label)}`;
    button.onmouseover = () => {
      button.style.transform = 'translateY(-2px)';
      button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
      button.style.filter = 'brightness(1.1)';
    };
    button.onmouseout = () => {
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = '0 2px 6px rgba(0,0,0,0.12)';
      button.style.filter = 'brightness(1)';
    };
    button.onclick = () => {
      handleSuggestedAction(action);
    };
    actionsBar.appendChild(button);
  });
  const messagesContainer = document.getElementById('ai-chat-messages');
  if (messagesContainer) {
    messagesContainer.appendChild(actionsBar);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

function displayHumanEscalationPrompt() {
  const messagesContainer = document.getElementById('ai-chat-messages');
  if (!messagesContainer) return;
  const existingPrompt = document.getElementById('escalation-prompt');
  if (existingPrompt) return;
  const escalationPrompt = document.createElement('div');
  escalationPrompt.id = 'escalation-prompt';
  escalationPrompt.className = 'ai-message assistant-message';
  escalationPrompt.style.cssText = `
    background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
    border: 2px solid #ef4444;
    border-radius: 16px;
    padding: 20px;
    margin: 16px 0;
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
  `;
  const header = document.createElement('div');
  header.style.cssText = `display: flex; align-items: center; gap: 12px; margin-bottom: 12px;`;
  const icon = document.createElement('span');
  icon.style.fontSize = '28px';
  icon.textContent = '👤';
  header.appendChild(icon);
  const title = document.createElement('h3');
  title.style.cssText = `margin: 0; font-size: 16px; font-weight: 700; color: #991b1b;`;
  title.textContent = 'Need to speak with a human?';
  header.appendChild(title);
  escalationPrompt.appendChild(header);
  const message = document.createElement('p');
  message.style.cssText = `margin: 0 0 16px 0; font-size: 14px; color: #7f1d1d; line-height: 1.5;`;
  message.textContent = 'It looks like you might need personalized assistance. Our support team is ready to help you!';
  escalationPrompt.appendChild(message);
  const buttonsContainer = document.createElement('div');
  buttonsContainer.style.cssText = `display: flex; gap: 10px; flex-wrap: wrap;`;
  const connectBtn = document.createElement('button');
  connectBtn.textContent = '💬 Talk to Support';
  connectBtn.style.cssText = `
    background: #ef4444;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    flex: 1;
    min-width: 140px;
  `;
  connectBtn.onmouseover = () => {
    connectBtn.style.background = '#dc2626';
    connectBtn.style.transform = 'translateY(-1px)';
    connectBtn.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
  };
  connectBtn.onmouseout = () => {
    connectBtn.style.background = '#ef4444';
    connectBtn.style.transform = 'translateY(0)';
    connectBtn.style.boxShadow = 'none';
  };
  connectBtn.onclick = () => {
    const safeUrl = sanitizeUrl('/pages/contact');
    if (safeUrl) window.open(safeUrl, '_blank', 'noopener,noreferrer');
  };
  buttonsContainer.appendChild(connectBtn);
  const continueBtn = document.createElement('button');
  continueBtn.textContent = '🤖 Continue with AI';
  continueBtn.style.cssText = `
    background: white;
    color: #ef4444;
    border: 2px solid #ef4444;
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    flex: 1;
    min-width: 140px;
  `;
  continueBtn.onmouseover = () => {
    continueBtn.style.background = '#fef2f2';
    continueBtn.style.transform = 'translateY(-1px)';
  };
  continueBtn.onmouseout = () => {
    continueBtn.style.background = 'white';
    continueBtn.style.transform = 'translateY(0)';
  };
  continueBtn.onclick = () => {
    escalationPrompt.style.animation = 'fadeOut 0.3s ease';
    setTimeout(() => escalationPrompt.remove(), 300);
    addMessageToChat('assistant', 'No problem! I\'m here to help. What else can I assist you with? 😊');
  };
  buttonsContainer.appendChild(continueBtn);
  escalationPrompt.appendChild(buttonsContainer);
  messagesContainer.appendChild(escalationPrompt);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function applySentimentStyling(sentiment) {
  const chatHeader = document.querySelector('.ai-chat-header');
  const messagesContainer = document.getElementById('ai-chat-messages');
  if (!chatHeader || !messagesContainer) return;
  const sentimentStyles = {
    positive: {
      headerGradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      headerShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
      messagesBg: '#f0fdf4',
      accentColor: '#10b981'
    },
    negative: {
      headerGradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      headerShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
      messagesBg: '#fffbeb',
      accentColor: '#f59e0b'
    },
    neutral: {
      headerGradient: `linear-gradient(135deg, ${widgetSettings.primaryColor || '#ee5cee'} 0%, ${adjustColor(widgetSettings.primaryColor || '#ee5cee', -20)} 100%)`,
      headerShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      messagesBg: '#ffffff',
      accentColor: widgetSettings.primaryColor || '#ee5cee'
    }
  };
  const style = sentimentStyles[sentiment] || sentimentStyles.neutral;
  chatHeader.style.transition = 'all 0.5s ease';
  chatHeader.style.background = style.headerGradient;
  chatHeader.style.boxShadow = style.headerShadow;
  if (messagesContainer) {
    messagesContainer.style.transition = 'background-color 0.5s ease';
    messagesContainer.style.backgroundColor = style.messagesBg;
  }
  const quickReplyButtons = document.querySelectorAll('.quick-reply-btn');
  quickReplyButtons.forEach(btn => {
    btn.style.transition = 'all 0.3s ease';
    btn.style.borderColor = style.accentColor;
    btn.style.color = style.accentColor;
  });
}

function displayProductRecommendations(recommendations) {
  // 🐛 DEBUG: Log recommendations received
  console.log('🐛 DEBUG: displayProductRecommendations called with:', recommendations);
  if (recommendations.length > 0) {
    console.log('🐛 DEBUG: First product:', {
      title: recommendations[0].title,
      image: recommendations[0].image,
      hasImage: !!recommendations[0].image
    });
  }

  const messagesContainer = document.getElementById('ai-chat-messages');
  if (!messagesContainer) return;

  const productsContainer = document.createElement('div');
  productsContainer.className = 'ai-message assistant-message products-list-container';
  productsContainer.style.marginBottom = '12px';
  productsContainer.style.maxWidth = '100%';
  productsContainer.style.width = '100%';
  productsContainer.style.backgroundColor = 'transparent';
  productsContainer.style.border = 'none';
  productsContainer.style.boxShadow = 'none';
  productsContainer.style.padding = '0';
  productsContainer.style.display = 'block';

  const listContent = document.createElement('div');
  listContent.className = 'products-list';
  listContent.style.display = 'flex';
  listContent.style.flexDirection = 'column';
  listContent.style.gap = '8px';
  listContent.style.width = '100%';

  recommendations.forEach((product, index) => {
    const productCard = document.createElement('div');
    productCard.className = 'product-card-compact clickable-product';
    productCard.style.backgroundColor = '#fff';
    productCard.style.border = '1px solid #e5e7eb';
    productCard.style.borderRadius = '8px';
    productCard.style.cursor = 'pointer';
    productCard.style.transition = 'all 0.2s ease';
    productCard.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.06)';
    productCard.style.display = 'flex';
    productCard.style.flexDirection = 'row';
    productCard.style.alignItems = 'center';
    productCard.style.padding = '8px';
    productCard.style.gap = '10px';
    productCard.style.minHeight = '86px';
    productCard.style.maxHeight = '86px';

    // Image section - compact thumbnail (always show, with placeholder if no image)
    const imageDiv = document.createElement('div');
    imageDiv.className = 'product-image-compact';
    imageDiv.style.width = '70px';
    imageDiv.style.minWidth = '70px';
    imageDiv.style.height = '70px';
    imageDiv.style.position = 'relative';
    imageDiv.style.overflow = 'hidden';
    imageDiv.style.borderRadius = '6px';
    imageDiv.style.flexShrink = '0';
    imageDiv.style.backgroundColor = '#f3f4f6';

    // Sanitize and check if we have a valid image URL
    const sanitizedImageUrl = product.image ? sanitizeUrl(product.image) : '';

    // 🐛 DEBUG: Log sanitization and rendering
    console.log('🐛 DEBUG: Image rendering for', product.title, {
      originalUrl: product.image,
      sanitizedUrl: sanitizedImageUrl,
      willShowImage: !!sanitizedImageUrl
    });

    if (sanitizedImageUrl) {
      // Show product image
      const escapedUrl = sanitizedImageUrl.replace(/'/g, "\\'");
      const bgImageStyle = `url('${escapedUrl}')`;
      imageDiv.style.backgroundImage = bgImageStyle;
      imageDiv.style.backgroundSize = 'cover';
      imageDiv.style.backgroundPosition = 'center';
      imageDiv.style.setProperty('display', 'block', 'important'); // Force display with !important to override any CSS

      // 🐛 DEBUG: Verify style was applied
      console.log('🐛 DEBUG: Applied backgroundImage style:', bgImageStyle);
      console.log('🐛 DEBUG: imageDiv computed style:', {
        backgroundImage: imageDiv.style.backgroundImage,
        width: imageDiv.style.width,
        height: imageDiv.style.height,
        display: imageDiv.style.display
      });
    } else {
      // Placeholder icon when no image available or sanitization fails
      console.log('🐛 DEBUG: Showing placeholder for', product.title);
      imageDiv.style.setProperty('display', 'flex', 'important'); // Force display with !important
      imageDiv.style.alignItems = 'center';
      imageDiv.style.justifyContent = 'center';
      imageDiv.style.fontSize = '28px';
      imageDiv.innerHTML = '🛍️';
    }

    // Only show discount badge if applicable - small pill style
    if (product.badge || product.discountPercent) {
      const discountBadge = document.createElement('div');
      discountBadge.style.position = 'absolute';
      discountBadge.style.top = '4px';
      discountBadge.style.left = '4px';
      discountBadge.style.background = '#ef4444';
      discountBadge.style.color = 'white';
      discountBadge.style.padding = '2px 6px';
      discountBadge.style.borderRadius = '4px';
      discountBadge.style.fontSize = '9px';
      discountBadge.style.fontWeight = '700';
      discountBadge.style.lineHeight = '1';
      discountBadge.textContent = product.badge || `-${product.discountPercent}%`;
      imageDiv.appendChild(discountBadge);
    }

    productCard.appendChild(imageDiv);

    // Content section - title and price only
    const contentDiv = document.createElement('div');
    contentDiv.style.flex = '1';
    contentDiv.style.display = 'flex';
    contentDiv.style.flexDirection = 'column';
    contentDiv.style.justifyContent = 'center';
    contentDiv.style.gap = '4px';
    contentDiv.style.minWidth = '0';
    contentDiv.style.overflow = 'hidden';

    // Title - single line with ellipsis
    const titleDiv = document.createElement('div');
    titleDiv.style.fontSize = '14px';
    titleDiv.style.fontWeight = '600';
    titleDiv.style.color = '#111827';
    titleDiv.style.lineHeight = '1.3';
    titleDiv.style.whiteSpace = 'nowrap';
    titleDiv.style.overflow = 'hidden';
    titleDiv.style.textOverflow = 'ellipsis';
    titleDiv.textContent = product.title || 'Untitled Product';
    contentDiv.appendChild(titleDiv);

    // Price row - subtle but clear
    const priceRow = document.createElement('div');
    priceRow.style.display = 'flex';
    priceRow.style.alignItems = 'center';
    priceRow.style.gap = '6px';

    // Current price
    const priceDiv = document.createElement('div');
    priceDiv.style.fontSize = '15px';
    priceDiv.style.fontWeight = '700';
    priceDiv.style.color = widgetSettings.primaryColor;
    priceDiv.textContent = product.priceFormatted || `$${parseFloat(product.price || '0').toFixed(2)}`;
    priceRow.appendChild(priceDiv);

    // Original price if on sale
    if (product.compareAtPrice && parseFloat(product.compareAtPrice) > parseFloat(product.price)) {
      const originalPriceSpan = document.createElement('span');
      originalPriceSpan.style.fontSize = '12px';
      originalPriceSpan.style.color = '#9ca3af';
      originalPriceSpan.style.textDecoration = 'line-through';
      originalPriceSpan.style.fontWeight = '500';
      originalPriceSpan.textContent = `$${parseFloat(product.compareAtPrice).toFixed(2)}`;
      priceRow.appendChild(originalPriceSpan);
    }

    contentDiv.appendChild(priceRow);
    productCard.appendChild(contentDiv);

    // Action - small text link style
    const actionLink = document.createElement('div');
    actionLink.style.color = widgetSettings.primaryColor;
    actionLink.style.fontSize = '13px';
    actionLink.style.fontWeight = '600';
    actionLink.style.whiteSpace = 'nowrap';
    actionLink.style.display = 'flex';
    actionLink.style.alignItems = 'center';
    actionLink.style.gap = '4px';
    actionLink.style.paddingRight = '4px';
    actionLink.innerHTML = `<span>View</span><span style="font-size: 14px;">→</span>`;
    productCard.appendChild(actionLink);

    // Click handler
    productCard.addEventListener('click', async function(e) {
      e.preventDefault();
      e.stopPropagation();

      // Track analytics
      trackAnalytics(analyticsEvents.PRODUCT_CLICKED, {
        productTitle: product.title,
        productHandle: product.handle,
        productPrice: product.price,
        relevanceScore: product.relevanceScore,
        position: index + 1
      });

      // Backend tracking
      try {
        const productId = product.id || product.handle;
        await fetch('https://shopibot.vercel.app/api/track-product-click', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            shop: widgetSettings.shopDomain,
            productId: productId,
            productHandle: product.handle,
            productTitle: product.title,
            sessionId: sessionId
          })
        }).catch(err => console.debug('Product click tracking failed:', err));
      } catch (error) {
        console.debug('Product click tracking error:', error);
      }

      const productUrl = product.fullUrl || `/products/${product.handle}`;
      const safeUrl = sanitizeUrl(productUrl);
      if (safeUrl) {
        window.open(safeUrl, '_blank', 'noopener,noreferrer');
      }
    });

    // Hover effects - subtle
    productCard.addEventListener('mouseenter', function() {
      this.style.borderColor = widgetSettings.primaryColor;
      this.style.boxShadow = `0 2px 8px rgba(0, 0, 0, 0.1)`;
      this.style.backgroundColor = '#fafafa';
    });

    productCard.addEventListener('mouseleave', function() {
      this.style.borderColor = '#e5e7eb';
      this.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.06)';
      this.style.backgroundColor = '#fff';
    });

    listContent.appendChild(productCard);
  });

  productsContainer.appendChild(listContent);
  messagesContainer.appendChild(productsContainer);

  // Browse all button - only if 3+ products
  if (recommendations.length > 2) {
    const browseMoreDiv = document.createElement('div');
    browseMoreDiv.className = 'ai-message assistant-message';
    browseMoreDiv.style.marginTop = '8px';
    browseMoreDiv.style.textAlign = 'center';
    browseMoreDiv.style.backgroundColor = 'transparent';
    browseMoreDiv.style.border = 'none';
    browseMoreDiv.style.boxShadow = 'none';
    browseMoreDiv.style.padding = '0';

    const browseButton = document.createElement('button');
    browseButton.style.background = 'transparent';
    browseButton.style.border = 'none';
    browseButton.style.color = widgetSettings.primaryColor;
    browseButton.style.padding = '8px 16px';
    browseButton.style.borderRadius = '6px';
    browseButton.style.fontSize = '13px';
    browseButton.style.fontWeight = '600';
    browseButton.style.cursor = 'pointer';
    browseButton.style.transition = 'all 0.2s ease';
    browseButton.style.display = 'inline-flex';
    browseButton.style.alignItems = 'center';
    browseButton.style.gap = '4px';
    browseButton.innerHTML = `<span>Browse all</span><span style="font-size: 14px;">→</span>`;

    browseButton.addEventListener('click', function() {
      const safeUrl = sanitizeUrl('/collections/all');
      if (safeUrl) {
        window.open(safeUrl, '_blank', 'noopener,noreferrer');
      }
    });

    browseButton.addEventListener('mouseenter', function() {
      this.style.backgroundColor = `${widgetSettings.primaryColor}10`;
    });

    browseButton.addEventListener('mouseleave', function() {
      this.style.backgroundColor = 'transparent';
    });

    browseMoreDiv.appendChild(browseButton);
    messagesContainer.appendChild(browseMoreDiv);
  }

  scrollToBottom();
}

// ======================
// Cart Integration
// ======================

async function addToCart(productHandle, variantId, quantity = 1) {
  try {
    showNotification('Adding to cart...', 'info');
    if (variantId) {
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ id: variantId, quantity: quantity }] })
      });
      if (!response.ok) throw new Error('Failed to add to cart');
      const data = await response.json();
      showNotification('Added to cart! 🛒', 'success');
      updateCartCount();
      return true;
    } else {
      const productResponse = await fetch(`/products/${productHandle}.js`);
      if (!productResponse.ok) throw new Error('Product not found');
      const product = await productResponse.json();
      const firstAvailableVariant = product.variants.find(v => v.available);
      if (!firstAvailableVariant) throw new Error('Product is out of stock');
      const addResponse = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ id: firstAvailableVariant.id, quantity: quantity }] })
      });
      if (!addResponse.ok) throw new Error('Failed to add to cart');
      showNotification('Added to cart! 🛒', 'success');
      updateCartCount();
      return true;
    }
  } catch (error) {
    showNotification('Failed to add to cart', 'error');
    return false;
  }
}

function updateCartCount() {
  fetch('/cart.js')
    .then(res => res.json())
    .then(cart => {
      const cartCountElements = document.querySelectorAll('[data-cart-count], .cart-count, #cart-count');
      cartCountElements.forEach(el => {
        if (el) el.textContent = cart.item_count;
      });
    })
    .catch(() => {}); // Silently fail if cart endpoint not available
}

function handleSuggestedAction(action) {
  switch(action.action) {
    case 'view_product':
      if (action.data) {
        const productUrl = action.data.startsWith('http')
          ? action.data
          : `/products/${action.data}`;
        const safeUrl = sanitizeUrl(productUrl);
        if (safeUrl) {
          window.open(safeUrl, '_blank', 'noopener,noreferrer');
        }
      }
      break;
    case 'add_to_cart':
      if (action.data) {
        const isVariantId = /^\d+$/.test(action.data);
        if (isVariantId) {
          addToCart(null, action.data);
        } else {
          addToCart(action.data, null);
        }
      }
      break;
    case 'compare':
      addMessageToChat('assistant', 'Product comparison feature coming soon! ⚖️');
      break;
    case 'custom':
      break;
    default:
  }
}

// ======================
// Event Handlers
// ======================

function toggleAIChat() {
  // Toggle chat state
  chatOpen = !chatOpen;

  // Track analytics
  trackAnalytics(
    chatOpen ? analyticsEvents.WIDGET_OPENED : analyticsEvents.WIDGET_CLOSED,
    {
      timestamp: new Date().toISOString(),
      conversationLength: conversationHistory.length
    }
  );

  // Mark chat as opened in sessionStorage to prevent welcome popup
  if (chatOpen) {
    try {
      sessionStorage.setItem('ai_chat_opened', 'true');
    } catch (e) {
      // Ignore if sessionStorage unavailable
    }
  }

  // Update toggle button accessibility attributes
  if (elements.toggleBtn) {
    elements.toggleBtn.setAttribute('aria-expanded', chatOpen.toString());
    elements.toggleBtn.setAttribute(
      'aria-label',
      chatOpen ? 'Close AI chat assistant' : 'Open AI chat assistant'
    );
  }

  // Show or hide chat window
  if (elements.chatWindow) {
    if (chatOpen) {
      // Generate new conversation ID for rating tracking (independent of backend session)
      conversationId = 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      console.log('[Rating Debug] New conversation started, ID:', conversationId);

      elements.chatWindow.classList.add('ai-chat-open');
      // Focus input after opening
      setTimeout(() => {
        elements.inputField?.focus();
      }, 200);
      scrollToBottom();
    } else {
      // Close chat window immediately
      elements.chatWindow.classList.remove('ai-chat-open');

      // Show rating modal popup (outside chat container)
      console.log('[Rating Debug] Chat closed, attempting to show rating modal');
      showRatingModal();

      // Return focus to toggle button after closing
      setTimeout(() => {
        elements.toggleBtn?.focus();
      }, 100);
    }
  }
}

function handleChatKeyPress(event) {
  if (event.key === 'Enter') {
    sendAIMessage();
  }
}

function sendAIMessage() {
  if (!elements.inputField) return;
  const message = elements.inputField.value.trim();
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

// Generate quick actions HTML based on visibility settings
function getQuickActionsHTML() {
  // Check if visibility settings exist (default to true for backward compatibility)
  const isVisible = (key) => widgetSettings[key] !== false;

  // Build discovery section buttons
  const discoveryButtons = [];
  if (isVisible('bestSellersVisible')) {
    discoveryButtons.push(`<button class="quick-action-btn" data-prompt="${escapeHTML(t('bestSellersPrompt'))}">
      <span class="quick-action-text">${escapeHTML(widgetSettings.bestSellersText || t('bestSellers'))}</span>
    </button>`);
  }
  if (isVisible('newArrivalsVisible')) {
    discoveryButtons.push(`<button class="quick-action-btn" data-prompt="${escapeHTML(t('newArrivalsPrompt'))}">
      <span class="quick-action-text">${escapeHTML(widgetSettings.newArrivalsText || t('newArrivals'))}</span>
    </button>`);
  }
  if (isVisible('onSaleVisible')) {
    discoveryButtons.push(`<button class="quick-action-btn" data-prompt="${escapeHTML(t('onSalePrompt'))}">
      <span class="quick-action-text">${escapeHTML(widgetSettings.onSaleText || t('onSale'))}</span>
    </button>`);
  }
  if (isVisible('recommendationsVisible')) {
    discoveryButtons.push(`<button class="quick-action-btn" data-prompt="${escapeHTML(t('recommendedPrompt'))}">
      <span class="quick-action-text">${escapeHTML(widgetSettings.recommendationsText || t('recommended'))}</span>
    </button>`);
  }

  // Build support section buttons
  const supportButtons = [];
  if (isVisible('shippingVisible')) {
    supportButtons.push(`<button class="quick-action-btn" data-prompt="${escapeHTML(t('shippingPrompt'))}">
      <span class="quick-action-text">${escapeHTML(widgetSettings.shippingText || t('shipping'))}</span>
    </button>`);
  }
  if (isVisible('returnsVisible')) {
    supportButtons.push(`<button class="quick-action-btn" data-prompt="${escapeHTML(t('returnsPrompt'))}">
      <span class="quick-action-text">${escapeHTML(widgetSettings.returnsText || t('returns'))}</span>
    </button>`);
  }
  if (isVisible('trackOrderVisible')) {
    supportButtons.push(`<button class="quick-action-btn" data-prompt="${escapeHTML(t('trackOrderPrompt'))}">
      <span class="quick-action-text">${escapeHTML(widgetSettings.trackOrderText || t('trackOrder'))}</span>
    </button>`);
  }
  if (isVisible('helpVisible')) {
    supportButtons.push(`<button class="quick-action-btn" data-prompt="I need help with something">
      <span class="quick-action-text">${escapeHTML(widgetSettings.helpText || t('help'))}</span>
    </button>`);
  }

  // Check if all buttons are hidden
  const hasNoButtons = discoveryButtons.length === 0 && supportButtons.length === 0;

  if (hasNoButtons) {
    // Show fallback message when all buttons are hidden
    return `<div class="quick-actions-fallback">
      <p class="fallback-text">${escapeHTML(t('typeYourQuestion') || 'Type your question below to get started')}</p>
    </div>`;
  }

  // Build sections HTML
  let html = '';

  if (discoveryButtons.length > 0) {
    html += `<div class="quick-actions-section">
      <div class="section-label"><span>${escapeHTML(widgetSettings.sectionDiscoveryLabel || t('discover'))}</span></div>
      <div class="quick-actions-grid">
        ${discoveryButtons.join('\n')}
      </div>
    </div>`;
  }

  if (supportButtons.length > 0) {
    html += `<div class="quick-actions-section">
      <div class="section-label"><span>${escapeHTML(widgetSettings.sectionSupportLabel || t('support'))}</span></div>
      <div class="quick-actions-grid">
        ${supportButtons.join('\n')}
      </div>
    </div>`;
  }

  return html;
}

function createWidget() {
  if (!widgetSettings?.enabled) return;

  const container = document.getElementById('ai-sales-assistant-container');
  if (!container) {
    console.warn('AI Sales Assistant: container not found');
    return;
  }

  // Set CSS variables for theming
  if (widgetSettings.primaryColor && document.documentElement) {
    document.documentElement.style.setProperty('--ai-primary-color', widgetSettings.primaryColor);
    const rgb = hexToRgb(widgetSettings.primaryColor);
    if (rgb) {
      const darker = `rgb(${Math.max(0, rgb.r - 40)}, ${Math.max(0, rgb.g - 40)}, ${Math.max(0, rgb.b - 40)})`;
      document.documentElement.style.setProperty('--ai-primary-color-dark', darker);
      document.documentElement.style.setProperty('--ai-primary-color-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    }
  }

  // Sanitize position string
  const safePosition = String(widgetSettings.position || 'bottom-right').replace(/[^a-z-]/gi, '');

  // Render widget HTML
  container.innerHTML = `
    <div class="ai-sales-assistant-widget position-${safePosition}" data-widget-id="ai-sales-assistant">
      <button class="ai-chat-toggle" id="ai-chat-toggle-btn" aria-label="Open AI chat assistant" aria-expanded="false" aria-controls="ai-chat-window">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M12 2C6.48 2 2 6.48 2 12C2 13.93 2.6 15.71 3.62 17.19L2.5 21.5L6.81 20.38C8.29 21.4 10.07 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z" fill="white"/>
          <path d="M8.5 10.5C8.91421 10.5 9.25 10.1642 9.25 9.75C9.25 9.33579 8.91421 9 8.5 9C8.08579 9 7.75 9.33579 7.75 9.75C7.75 10.1642 8.08579 10.5 8.5 10.5Z" fill="currentColor"/>
          <path d="M12 10.5C12.4142 10.5 12.75 10.1642 12.75 9.75C12.75 9.33579 12.4142 9 12 9C11.5858 9 11.25 9.33579 11.25 9.75C11.25 10.1642 11.5858 10.5 12 10.5Z" fill="currentColor"/>
          <path d="M15.5 10.5C15.9142 10.5 16.25 10.1642 16.25 9.75C16.25 9.33579 15.9142 9 15.5 9C15.0858 9 14.75 9.33579 14.75 9.75C14.75 10.1642 15.0858 10.5 15.5 10.5Z" fill="currentColor"/>
          <path d="M7 13C7 12.7239 7.22386 12.5 7.5 12.5H16.5C16.7761 12.5 17 12.7239 17 13C17 13.2761 16.7761 13.5 16.5 13.5H7.5C7.22386 13.5 7 13.2761 7 13Z" fill="currentColor"/>
          <path d="M7 15.5C7 15.2239 7.22386 15 7.5 15H13.5C13.7761 15 14 15.2239 14 15.5C14 15.7761 13.7761 16 13.5 16H7.5C7.22386 16 7 15.7761 7 15.5Z" fill="currentColor"/>
        </svg>
        <span class="button-text">${escapeHTML(widgetSettings.buttonText || 'Chat')}</span>
      </button>

      <div id="ai-chat-window" class="ai-chat-window" style="display: none;" role="dialog" aria-labelledby="ai-chat-title" aria-modal="true">
        <div class="ai-chat-header">
          <div class="chat-header-content">
            <div class="header-info">
              <h3 id="ai-chat-title">${escapeHTML(widgetSettings.chatTitle || 'AI Assistant')}</h3>
              <div class="header-status">
                <span class="status-dot"></span>
                <span class="status-text">${escapeHTML(widgetSettings.statusText || t('online'))}</span>
              </div>
            </div>
            <button class="ai-chat-close" id="ai-chat-close-btn" aria-label="${escapeHTML(widgetSettings.closeButtonLabel || t('close'))}" title="Close chat (Esc)">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M13.5 4.5L4.5 13.5M4.5 4.5L13.5 13.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
          <svg class="header-curve" viewBox="0 0 400 40" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,0 Q100,35 200,20 T400,0 L400,40 L0,40 Z" fill="white"/>
          </svg>
        </div>

        <div class="ai-chat-messages-container">
          <div id="ai-chat-messages" class="ai-chat-messages" role="log" aria-live="polite">
            <div class="ai-message assistant-message ai-welcome-message">
              <div class="ai-welcome-screen">
                <div class="welcome-header">
                  <h2 class="welcome-title">${escapeHTML(widgetSettings.welcomeMessage || 'Hello! How can I assist you?')}</h2>
                </div>
                ${getQuickActionsHTML()}
              </div>
            </div>
          </div>
        </div>

        <div class="ai-chat-input">
          <div class="ai-chat-input-wrapper">
            <input type="text" id="ai-chat-input-field" placeholder="${escapeHTML(widgetSettings.inputPlaceholder || t('inputPlaceholder'))}" aria-label="Type your message" />
            <button id="ai-chat-send-btn" aria-label="Send message">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M18 2L9 11M18 2L12 18L9 11M18 2L2 8L9 11" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
          <div class="ai-powered-footer">${escapeHTML(t('poweredByAI'))}</div>
        </div>
      </div>
    </div>
  `;

  // Cache DOM elements and attach event listeners
  cacheDOMElements();
  setupEventListeners();
}
function cacheDOMElements() {
  elements.toggleBtn = document.getElementById('ai-chat-toggle-btn');
  elements.chatWindow = document.getElementById('ai-chat-window');
  elements.closeBtn = document.getElementById('ai-chat-close-btn');
  elements.inputField = document.getElementById('ai-chat-input-field');
  elements.messagesContainer = document.getElementById('ai-chat-messages');
  elements.sendBtn = document.getElementById('ai-chat-send-btn');
}

function setupEventListeners() {
  if (elements.toggleBtn) elements.toggleBtn.addEventListener('click', toggleAIChat);
  if (elements.closeBtn) elements.closeBtn.addEventListener('click', toggleAIChat);
  if (elements.sendBtn) elements.sendBtn.addEventListener('click', sendAIMessage);  // ✅ Correct!
  if (elements.inputField) elements.inputField.addEventListener('keypress', handleChatKeyPress);

  document.querySelectorAll('.quick-action-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const prompt = e.currentTarget.dataset.prompt;
      if (prompt && elements.inputField) {
        elements.inputField.value = prompt;
        sendAIMessage();
      }
    });
  });

  window.addEventListener('online', () => {
    isOnline = true;
    showNotification('Back online! Sending queued messages...', 'success');
    processMessageQueue();
  });
  
  window.addEventListener('offline', () => {
    isOnline = false;
    showNotification('You\'re offline. Messages will be queued.', 'info');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && chatOpen) toggleAIChat();
  });
}
// ======================
// Initialize
// ======================

// FINAL SAFE INIT — waits for container to appear
async function safeInit(retries = 20) {
  if (!window.aiSalesAssistantSettings?.enabled) {
    console.log('AI Sales Assistant: disabled');
    return;
  }

  const container = document.getElementById('ai-sales-assistant-container');
  if (container) {
    // Proceed only if container exists
    // Visibility settings come directly from Liquid/Theme Editor (no API call needed)
    widgetSettings = window.aiSalesAssistantSettings;

    // Load translations based on interfaceLanguage setting
    const lang = widgetSettings.interfaceLanguage || 'en';
    await loadTranslations(lang);

    loadConversationHistory();
    loadMessageQueue();
    createWidget();

    // Initialize welcome popup (shows after 3 seconds)
    initWelcomePopup();
  } else if (retries > 0) {
    // Retry if not found yet (common in Theme Editor)
    setTimeout(() => safeInit(retries - 1), 200);
  } else {
    console.warn('AI Sales Assistant: container not found after retries');
  }
}

// Start initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => safeInit());
} else {
  safeInit();
}