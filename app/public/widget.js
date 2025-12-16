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

    // ✅ CRITICAL FIX: Use correct chat API endpoint
    const url = `https://shopibot.vercel.app/apps/sales-assistant-api`;
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Shop-Domain': widgetSettings.shopDomain
      },
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
    button.textContent = reply;
    button.className = 'quick-reply-btn';
    button.style.cssText = `
      background: white;
      border: 1.5px solid ${widgetSettings.primaryColor || '#ee5cee'};
      color: ${widgetSettings.primaryColor || '#ee5cee'};
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 17px;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s ease;
      flex-shrink: 0;
    `;
    button.onmouseover = () => {
      button.style.background = widgetSettings.primaryColor || '#ee5cee';
      button.style.color = 'white';
      button.style.transform = 'translateY(-1px)';
      button.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
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
  if (!chatHeader) return;
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
  const messagesContainer = document.getElementById('ai-chat-messages');
  const productsContainer = document.createElement('div');
  productsContainer.className = 'ai-message assistant-message products-grid-container';
  productsContainer.style.marginBottom = '16px';
  productsContainer.style.maxWidth = '100%';
  productsContainer.style.width = '100%';
  productsContainer.style.backgroundColor = 'transparent';
  productsContainer.style.border = 'none';
  productsContainer.style.boxShadow = 'none';
  productsContainer.style.padding = '0';
  const gridContent = document.createElement('div');
  gridContent.className = 'products-grid';
  gridContent.style.display = 'flex';
  gridContent.style.overflowX = 'auto';
  gridContent.style.overflowY = 'hidden';
  gridContent.style.gap = '12px';
  gridContent.style.padding = '12px 8px';
  gridContent.style.scrollSnapType = 'x mandatory';
  gridContent.style.webkitOverflowScrolling = 'touch';
  gridContent.style.scrollbarWidth = 'thin';
  gridContent.style.scrollbarColor = `${widgetSettings.primaryColor} #f3f4f6`;
  if (recommendations.length > 1) {
    const scrollHint = document.createElement('div');
    scrollHint.style.textAlign = 'center';
    scrollHint.style.fontSize = '12px';
    scrollHint.style.color = '#6b7280';
    scrollHint.style.marginBottom = '8px';
    scrollHint.style.fontWeight = '500';
    scrollHint.innerHTML = '👈 Swipe to see more 👉';
    scrollHint.style.animation = 'fadeOut 3s ease forwards';
    productsContainer.appendChild(scrollHint);
  }
  recommendations.forEach((product, index) => {
    const productCard = document.createElement('div');
    productCard.className = 'product-card clickable-product';
    productCard.style.backgroundColor = '#fff';
    productCard.style.border = '1px solid #e5e7eb';
    productCard.style.borderRadius = '16px';
    productCard.style.overflow = 'hidden';
    productCard.style.cursor = 'pointer';
    productCard.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    productCard.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
    productCard.style.position = 'relative';
    productCard.style.minWidth = '280px';
    productCard.style.maxWidth = '280px';
    productCard.style.flexShrink = '0';
    productCard.style.scrollSnapAlign = 'start';
    productCard.style.display = 'flex';
    productCard.style.flexDirection = 'column';
    productCard.style.height = 'auto';
    if (product.image) {
      const imageDiv = document.createElement('div');
      imageDiv.className = 'product-image';
      imageDiv.style.width = '100%';
      imageDiv.style.height = '180px';
      imageDiv.style.position = 'relative';
      imageDiv.style.overflow = 'hidden';
      const sanitizedImageUrl = sanitizeUrl(product.image);
      if (sanitizedImageUrl) {
        const escapedUrl = sanitizedImageUrl.replace(/'/g, "\\'");
        imageDiv.style.backgroundImage = `url('${escapedUrl}')`;
      }
      imageDiv.style.backgroundSize = 'cover';
      imageDiv.style.backgroundPosition = 'center';
      imageDiv.style.backgroundColor = '#f8f9fa';
      const overlayDiv = document.createElement('div');
      overlayDiv.style.position = 'absolute';
      overlayDiv.style.bottom = '0';
      overlayDiv.style.left = '0';
      overlayDiv.style.right = '0';
      overlayDiv.style.height = '50%';
      overlayDiv.style.background = 'linear-gradient(to top, rgba(0,0,0,0.3), transparent)';
      overlayDiv.style.pointerEvents = 'none';
      imageDiv.appendChild(overlayDiv);
      const badgesContainer = document.createElement('div');
      badgesContainer.style.position = 'absolute';
      badgesContainer.style.top = '10px';
      badgesContainer.style.left = '10px';
      badgesContainer.style.display = 'flex';
      badgesContainer.style.flexDirection = 'column';
      badgesContainer.style.gap = '6px';
      badgesContainer.style.zIndex = '2';
      if (product.badge || product.discountPercent) {
        const discountBadge = document.createElement('div');
        discountBadge.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        discountBadge.style.color = 'white';
        discountBadge.style.padding = '6px 12px';
        discountBadge.style.borderRadius = '8px';
        discountBadge.style.fontSize = '12px';
        discountBadge.style.fontWeight = '700';
        discountBadge.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.4)';
        discountBadge.style.letterSpacing = '0.5px';
        discountBadge.textContent = product.badge || `${product.discountPercent}% OFF`;
        badgesContainer.appendChild(discountBadge);
      }
      if (product.isLowStock && product.inventory) {
        const stockBadge = document.createElement('div');
        stockBadge.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
        stockBadge.style.color = 'white';
        stockBadge.style.padding = '5px 10px';
        stockBadge.style.borderRadius = '8px';
        stockBadge.style.fontSize = '11px';
        stockBadge.style.fontWeight = '600';
        stockBadge.style.boxShadow = '0 2px 6px rgba(245, 158, 11, 0.3)';
        stockBadge.textContent = `⚡ Only ${product.inventory} left!`;
        badgesContainer.appendChild(stockBadge);
      }
      if (badgesContainer.children.length > 0) {
        imageDiv.appendChild(badgesContainer);
      }
      if (product.relevanceScore) {
        const matchBadge = document.createElement('div');
        matchBadge.style.position = 'absolute';
        matchBadge.style.top = '10px';
        matchBadge.style.right = '10px';
        matchBadge.style.background = 'rgba(0, 0, 0, 0.75)';
        matchBadge.style.backdropFilter = 'blur(8px)';
        matchBadge.style.webkitBackdropFilter = 'blur(8px)';
        matchBadge.style.color = 'white';
        matchBadge.style.padding = '5px 10px';
        matchBadge.style.borderRadius = '12px';
        matchBadge.style.fontSize = '11px';
        matchBadge.style.fontWeight = '700';
        matchBadge.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
        matchBadge.style.zIndex = '2';
        matchBadge.innerHTML = `<span style="color: #10b981;">●</span> ${product.relevanceScore}% match`;
        imageDiv.appendChild(matchBadge);
      }
      productCard.appendChild(imageDiv);
    }
    const detailsDiv = document.createElement('div');
    detailsDiv.style.padding = '16px';
    detailsDiv.style.display = 'flex';
    detailsDiv.style.flexDirection = 'column';
    detailsDiv.style.flexGrow = '1';
    detailsDiv.style.gap = '8px';
    const titleH4 = document.createElement('h4');
    titleH4.style.margin = '0';
    titleH4.style.fontSize = '16px';
    titleH4.style.fontWeight = '700';
    titleH4.style.color = '#111827';
    titleH4.style.lineHeight = '1.3';
    titleH4.style.display = '-webkit-box';
    titleH4.style.webkitLineClamp = '2';
    titleH4.style.webkitBoxOrient = 'vertical';
    titleH4.style.overflow = 'hidden';
    titleH4.style.minHeight = '40px';
    titleH4.textContent = product.title || 'Untitled Product';
    detailsDiv.appendChild(titleH4);
    if (product.rating || product.reviewCount) {
      const ratingDiv = document.createElement('div');
      ratingDiv.style.display = 'flex';
      ratingDiv.style.alignItems = 'center';
      ratingDiv.style.gap = '6px';
      const rating = product.rating || 0;
      const fullStars = Math.floor(rating);
      const hasHalfStar = rating % 1 >= 0.5;
      const starsSpan = document.createElement('span');
      starsSpan.style.color = '#fbbf24';
      starsSpan.style.fontSize = '14px';
      starsSpan.style.letterSpacing = '1px';
      starsSpan.textContent = '★'.repeat(fullStars) + (hasHalfStar ? '⯨' : '') + '☆'.repeat(5 - fullStars - (hasHalfStar ? 1 : 0));
      ratingDiv.appendChild(starsSpan);
      if (product.reviewCount) {
        const reviewSpan = document.createElement('span');
        reviewSpan.style.fontSize = '12px';
        reviewSpan.style.color = '#6b7280';
        reviewSpan.style.fontWeight = '500';
        reviewSpan.textContent = `(${product.reviewCount})`;
        ratingDiv.appendChild(reviewSpan);
      }
      detailsDiv.appendChild(ratingDiv);
    }
    const priceRow = document.createElement('div');
    priceRow.style.display = 'flex';
    priceRow.style.justifyContent = 'space-between';
    priceRow.style.alignItems = 'flex-start';
    priceRow.style.gap = '8px';
    priceRow.style.marginTop = '4px';
    const priceContainer = document.createElement('div');
    priceContainer.style.display = 'flex';
    priceContainer.style.flexDirection = 'column';
    priceContainer.style.gap = '2px';
    if (product.compareAtPrice && parseFloat(product.compareAtPrice) > parseFloat(product.price)) {
      const originalPriceSpan = document.createElement('span');
      originalPriceSpan.style.fontSize = '12px';
      originalPriceSpan.style.color = '#9ca3af';
      originalPriceSpan.style.textDecoration = 'line-through';
      originalPriceSpan.style.fontWeight = '500';
      originalPriceSpan.textContent = `$${parseFloat(product.compareAtPrice).toFixed(2)}`;
      priceContainer.appendChild(originalPriceSpan);
    }
    const priceDiv = document.createElement('div');
    priceDiv.style.fontSize = '24px';
    priceDiv.style.fontWeight = '800';
    priceDiv.style.letterSpacing = '-0.5px';
    if (product.compareAtPrice && parseFloat(product.compareAtPrice) > parseFloat(product.price)) {
      priceDiv.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
      priceDiv.style.webkitBackgroundClip = 'text';
      priceDiv.style.webkitTextFillColor = 'transparent';
      priceDiv.style.backgroundClip = 'text';
    } else {
      priceDiv.style.color = widgetSettings.primaryColor;
    }
    priceDiv.textContent = product.priceFormatted || `$${parseFloat(product.price || '0').toFixed(2)}`;
    priceContainer.appendChild(priceDiv);
    priceRow.appendChild(priceContainer);
    if (product.category) {
      const categoryDiv = document.createElement('div');
      categoryDiv.style.background = 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)';
      categoryDiv.style.color = '#4b5563';
      categoryDiv.style.padding = '4px 10px';
      categoryDiv.style.borderRadius = '8px';
      categoryDiv.style.fontSize = '11px';
      categoryDiv.style.fontWeight = '600';
      categoryDiv.style.whiteSpace = 'nowrap';
      categoryDiv.style.textTransform = 'uppercase';
      categoryDiv.style.letterSpacing = '0.5px';
      categoryDiv.textContent = product.category;
      priceRow.appendChild(categoryDiv);
    }
    detailsDiv.appendChild(priceRow);
    if (product.description) {
      const descP = document.createElement('p');
      descP.style.margin = '0';
      descP.style.fontSize = '13px';
      descP.style.color = '#6b7280';
      descP.style.lineHeight = '1.5';
      descP.style.display = '-webkit-box';
      descP.style.webkitLineClamp = '2';
      descP.style.webkitBoxOrient = 'vertical';
      descP.style.overflow = 'hidden';
      descP.textContent = product.description || 'No description available';
      detailsDiv.appendChild(descP);
    }
    if (product.urgencyMessage) {
      const urgencyDiv = document.createElement('div');
      urgencyDiv.style.display = 'flex';
      urgencyDiv.style.alignItems = 'center';
      urgencyDiv.style.gap = '8px';
      urgencyDiv.style.background = 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)';
      urgencyDiv.style.color = '#92400e';
      urgencyDiv.style.padding = '8px 12px';
      urgencyDiv.style.borderRadius = '10px';
      urgencyDiv.style.fontSize = '12px';
      urgencyDiv.style.fontWeight = '700';
      urgencyDiv.style.border = '1.5px solid #fbbf24';
      urgencyDiv.style.boxShadow = '0 2px 6px rgba(251, 191, 36, 0.2)';
      const iconSpan = document.createElement('span');
      iconSpan.textContent = '⚡';
      iconSpan.style.fontSize = '16px';
      urgencyDiv.appendChild(iconSpan);
      const textSpan = document.createElement('span');
      textSpan.textContent = product.urgencyMessage;
      urgencyDiv.appendChild(textSpan);
      detailsDiv.appendChild(urgencyDiv);
    }
    if (product.tags && product.tags.length > 0) {
      const tagsDiv = document.createElement('div');
      tagsDiv.style.display = 'flex';
      tagsDiv.style.flexWrap = 'wrap';
      tagsDiv.style.gap = '4px';
      tagsDiv.style.marginTop = '4px';
      product.tags.slice(0, 3).forEach(tag => {
        const tagSpan = document.createElement('span');
        tagSpan.style.display = 'inline-block';
        tagSpan.style.background = '#f3f4f6';
        tagSpan.style.color = '#4b5563';
        tagSpan.style.padding = '3px 8px';
        tagSpan.style.borderRadius = '6px';
        tagSpan.style.fontSize = '10px';
        tagSpan.style.fontWeight = '600';
        tagSpan.style.textTransform = 'uppercase';
        tagSpan.style.letterSpacing = '0.3px';
        tagSpan.textContent = tag;
        tagsDiv.appendChild(tagSpan);
      });
      detailsDiv.appendChild(tagsDiv);
    }
    const actionButton = document.createElement('button');
    actionButton.style.background = `linear-gradient(135deg, ${widgetSettings.primaryColor} 0%, ${adjustColor(widgetSettings.primaryColor, -15)} 100%)`;
    actionButton.style.color = 'white';
    actionButton.style.border = 'none';
    actionButton.style.textAlign = 'center';
    actionButton.style.padding = '12px 16px';
    actionButton.style.borderRadius = '10px';
    actionButton.style.fontSize = '15px';
    actionButton.style.fontWeight = '700';
    actionButton.style.marginTop = 'auto';
    actionButton.style.cursor = 'pointer';
    actionButton.style.transition = 'all 0.2s ease';
    actionButton.style.boxShadow = `0 4px 12px rgba(${hexToRgb(widgetSettings.primaryColor).r}, ${hexToRgb(widgetSettings.primaryColor).g}, ${hexToRgb(widgetSettings.primaryColor).b}, 0.3)`;
    actionButton.style.display = 'flex';
    actionButton.style.alignItems = 'center';
    actionButton.style.justifyContent = 'center';
    actionButton.style.gap = '8px';
    actionButton.innerHTML = `<span>View Details</span><span style="font-size: 18px;">→</span>`;
    actionButton.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-2px)';
      this.style.boxShadow = `0 6px 20px rgba(${hexToRgb(widgetSettings.primaryColor).r}, ${hexToRgb(widgetSettings.primaryColor).g}, ${hexToRgb(widgetSettings.primaryColor).b}, 0.4)`;
    });
    actionButton.addEventListener('mouseleave', function() {
      this.style.transform = 'translateY(0)';
      this.style.boxShadow = `0 4px 12px rgba(${hexToRgb(widgetSettings.primaryColor).r}, ${hexToRgb(widgetSettings.primaryColor).g}, ${hexToRgb(widgetSettings.primaryColor).b}, 0.3)`;
    });
    detailsDiv.appendChild(actionButton);
    productCard.appendChild(detailsDiv);
    productCard.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      trackAnalytics(analyticsEvents.PRODUCT_CLICKED, {
        productTitle: product.title,
        productHandle: product.handle,
        productPrice: product.price,
        relevanceScore: product.relevanceScore,
        position: index + 1
      });
      const productUrl = product.fullUrl || `/products/${product.handle}`;
      const safeUrl = sanitizeUrl(productUrl);
      if (safeUrl) {
        window.open(safeUrl, '_blank', 'noopener,noreferrer');
      }
      this.style.transform = 'scale(0.98)';
      setTimeout(() => {
        this.style.transform = 'scale(1)';
      }, 150);
    });
    productCard.addEventListener('mouseenter', function() {
      this.style.borderColor = widgetSettings.primaryColor;
      this.style.transform = 'translateY(-6px)';
      this.style.boxShadow = `0 12px 28px rgba(0, 0, 0, 0.15), 0 0 0 2px ${widgetSettings.primaryColor}20`;
    });
    productCard.addEventListener('mouseleave', function() {
      this.style.borderColor = '#e5e7eb';
      this.style.transform = 'translateY(0)';
      this.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
    });
    gridContent.appendChild(productCard);
  });
  productsContainer.appendChild(gridContent);
  messagesContainer.appendChild(productsContainer);
  if (recommendations.length > 2) {
    const browseMoreDiv = document.createElement('div');
    browseMoreDiv.className = 'ai-message assistant-message';
    browseMoreDiv.style.marginTop = '12px';
    browseMoreDiv.style.textAlign = 'center';
    browseMoreDiv.style.backgroundColor = 'transparent';
    browseMoreDiv.style.border = 'none';
    browseMoreDiv.style.boxShadow = 'none';
    browseMoreDiv.style.padding = '0';
    const browseButton = document.createElement('button');
    browseButton.style.background = 'white';
    browseButton.style.border = `2px solid ${widgetSettings.primaryColor}`;
    browseButton.style.color = widgetSettings.primaryColor;
    browseButton.style.padding = '12px 24px';
    browseButton.style.borderRadius = '30px';
    browseButton.style.fontSize = '15px';
    browseButton.style.fontWeight = '700';
    browseButton.style.cursor = 'pointer';
    browseButton.style.transition = 'all 0.3s ease';
    browseButton.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
    browseButton.style.display = 'inline-flex';
    browseButton.style.alignItems = 'center';
    browseButton.style.gap = '8px';
    browseButton.innerHTML = `<span>Browse All Products</span><span style="font-size: 18px;">🛍️</span>`;
    browseButton.addEventListener('click', function() {
      const safeUrl = sanitizeUrl('/collections/all');
      if (safeUrl) {
        window.open(safeUrl, '_blank', 'noopener,noreferrer');
      }
    });
    browseButton.addEventListener('mouseenter', function() {
      this.style.backgroundColor = widgetSettings.primaryColor;
      this.style.color = 'white';
      this.style.transform = 'translateY(-2px)';
      this.style.boxShadow = `0 4px 12px rgba(${hexToRgb(widgetSettings.primaryColor).r}, ${hexToRgb(widgetSettings.primaryColor).g}, ${hexToRgb(widgetSettings.primaryColor).b}, 0.3)`;
    });
    browseButton.addEventListener('mouseleave', function() {
      this.style.backgroundColor = 'white';
      this.style.color = widgetSettings.primaryColor;
      this.style.transform = 'translateY(0)';
      this.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
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
        el.textContent = cart.item_count;
      });
    });
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
      elements.chatWindow.classList.add('ai-chat-open');
      // Focus input after opening
      setTimeout(() => {
        elements.inputField?.focus();
      }, 200);
      scrollToBottom();
    } else {
      elements.chatWindow.classList.remove('ai-chat-open');
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

function createWidget() {
  if (!widgetSettings?.enabled) return;

  const container = document.getElementById('ai-sales-assistant-container');
  if (!container) {
    console.warn('AI Sales Assistant: container not found');
    return;
  }

  // Set CSS variables for theming
  if (widgetSettings.primaryColor) {
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
                <span class="status-text">${escapeHTML(widgetSettings.statusText || 'Online')}</span>
              </div>
            </div>
            <button class="ai-chat-close" id="ai-chat-close-btn" aria-label="${escapeHTML(widgetSettings.closeButtonLabel || 'Close')}" title="Close chat (Esc)">
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
                <div class="quick-actions-section">
                  <div class="section-label"><span>${escapeHTML(widgetSettings.sectionDiscoveryLabel || 'Discover')}</span></div>
                  <div class="quick-actions-grid">
                    <button class="quick-action-btn" data-prompt="What are your best-selling products?">
                      <span class="quick-action-icon">🏆</span>
                      <span class="quick-action-text">${escapeHTML(widgetSettings.bestSellersText || 'Best Sellers')}</span>
                    </button>
                    <button class="quick-action-btn" data-prompt="Show me new arrivals">
                      <span class="quick-action-icon">✨</span>
                      <span class="quick-action-text">${escapeHTML(widgetSettings.newArrivalsText || 'New Arrivals')}</span>
                    </button>
                    <button class="quick-action-btn" data-prompt="What products are on sale?">
                      <span class="quick-action-icon">🔥</span>
                      <span class="quick-action-text">${escapeHTML(widgetSettings.onSaleText || 'On Sale')}</span>
                    </button>
                    <button class="quick-action-btn" data-prompt="Show me recommendations for me">
                      <span class="quick-action-icon">💎</span>
                      <span class="quick-action-text">${escapeHTML(widgetSettings.recommendationsText || 'Recommended')}</span>
                    </button>
                  </div>
                </div>
                <div class="quick-actions-section">
                  <div class="section-label"><span>${escapeHTML(widgetSettings.sectionSupportLabel || 'Support')}</span></div>
                  <div class="quick-actions-grid">
                    <button class="quick-action-btn" data-prompt="Tell me about shipping and delivery">
                      <span class="quick-action-icon">📦</span>
                      <span class="quick-action-text">${escapeHTML(widgetSettings.shippingText || 'Shipping')}</span>
                    </button>
                    <button class="quick-action-btn" data-prompt="What is your return policy?">
                      <span class="quick-action-icon">↩️</span>
                      <span class="quick-action-text">${escapeHTML(widgetSettings.returnsText || 'Returns')}</span>
                    </button>
                    <button class="quick-action-btn" data-prompt="How can I track my order?">
                      <span class="quick-action-icon">🔍</span>
                      <span class="quick-action-text">${escapeHTML(widgetSettings.trackOrderText || 'Track Order')}</span>
                    </button>
                    <button class="quick-action-btn" data-prompt="I need help with something">
                      <span class="quick-action-icon">💬</span>
                      <span class="quick-action-text">${escapeHTML(widgetSettings.helpText || 'Help')}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="ai-chat-input">
          <div class="ai-chat-input-wrapper">
            <input type="text" id="ai-chat-input-field" placeholder="${escapeHTML(widgetSettings.inputPlaceholder || 'Type a message...')}" aria-label="Type your message" />
            <button id="ai-chat-send-btn" aria-label="Send message">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M18 2L9 11M18 2L12 18L9 11M18 2L2 8L9 11" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
          <div class="ai-powered-footer">Powered by AI</div>
        </div>
      </div>
    </div>
  `;
}

// ======================
// Initialize
// ======================

// FINAL SAFE INIT — waits for container to appear
function safeInit(retries = 20) {
  if (!window.aiSalesAssistantSettings?.enabled) {
    console.log('AI Sales Assistant: disabled');
    return;
  }

  const container = document.getElementById('ai-sales-assistant-container');
  if (container) {
    // Proceed only if container exists
    widgetSettings = window.aiSalesAssistantSettings;
    loadConversationHistory();
    loadMessageQueue();
    createWidget();
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