(function() {
  let chatOpen = false;
  let conversationHistory = [];
  let widgetSettings = null;
  let currentQuickReplies = []; // ✨ NEW: Track current quick replies
  let currentSentiment = 'neutral'; // ✨ NEW: Track sentiment for styling
  let currentSuggestedActions = []; // ✨ NEW: Track suggested actions

  function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function sanitizeColor(color) {
    if (!color) return '#ee5cee'; // default color
    if (/^#([0-9A-Fa-f]{3}){1,2}$/.test(color)) {
      return color;
    }
    return '#ee5cee'; // fallback to default if invalid
  }

  function sanitizeUrl(url) {
    if (!url) return '';
    const urlStr = String(url).trim();

    const dangerousProtocols = /^(javascript|data|vbscript|file|about):/i;
    if (dangerousProtocols.test(urlStr)) {
      console.warn('⚠️ Blocked dangerous URL protocol:', urlStr);
      return '';
    }

    if (urlStr.startsWith('http://') || urlStr.startsWith('https://') || urlStr.startsWith('/')) {
      return urlStr;
    }

    if (!urlStr.includes(':')) {
      return urlStr;
    }

    console.warn('⚠️ Blocked suspicious URL:', urlStr);
    return '';
  }

  async function fetchWithRetry(url, options = {}, maxRetries = 3) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);
        if (response.ok) {
          return response;
        }

        if (response.status >= 400 && response.status < 500) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        lastError = new Error(`Request failed with status ${response.status}`);
      } catch (error) {
        lastError = error;

        if (attempt === maxRetries) break;

        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

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
    } catch (e) {
      console.error('Failed to load conversation history:', e);
    }
    return false;
  }

  function saveConversationHistory() {
    try {
      localStorage.setItem('ai_chat_history', JSON.stringify({
        messages: conversationHistory,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.error('Failed to save conversation history:', e);
    }
  }

  let settingsCheckInterval = null;
  function cleanupWidget() {
    if (settingsCheckInterval) {
      clearInterval(settingsCheckInterval);
      settingsCheckInterval = null;
    }

    if (window.aiWidgetHandlers) {
      const toggleBtn = document.getElementById('ai-chat-toggle-btn');
      const closeBtn = document.getElementById('ai-chat-close-btn');
      const sendBtn = document.getElementById('ai-chat-send-btn');
      const inputField = document.getElementById('ai-chat-input-field');

      if (toggleBtn && window.aiWidgetHandlers.toggleHandler) {
        toggleBtn.removeEventListener('click', window.aiWidgetHandlers.toggleHandler);
      }
      if (closeBtn && window.aiWidgetHandlers.closeHandler) {
        closeBtn.removeEventListener('click', window.aiWidgetHandlers.closeHandler);
      }
      if (sendBtn && window.aiWidgetHandlers.sendHandler) {
        sendBtn.removeEventListener('click', window.aiWidgetHandlers.sendHandler);
      }
      if (inputField && window.aiWidgetHandlers.keyHandler) {
        inputField.removeEventListener('keypress', window.aiWidgetHandlers.keyHandler);
      }
      if (window.aiWidgetHandlers.escapeHandler) {
        document.removeEventListener('keydown', window.aiWidgetHandlers.escapeHandler);
      }
      if (window.aiWidgetHandlers.focusTrapHandler) {
        document.removeEventListener('keydown', window.aiWidgetHandlers.focusTrapHandler);
      }
      if (window.aiWidgetHandlers.outsideClickHandler) {
        document.removeEventListener('click', window.aiWidgetHandlers.outsideClickHandler);
      }
    }

  }

  window.cleanupAIWidget = cleanupWidget;

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
      detail: {
        event: eventName,
        timestamp: new Date().toISOString(),
        ...data
      }
    });
    window.dispatchEvent(event);

    if (typeof gtag === 'function') {
      gtag('event', eventName, data);
    }

    if (typeof dataLayer !== 'undefined') {
      dataLayer.push({
        event: eventName,
        ...data
      });
    }

    if (typeof fbq === 'function') {
      fbq('trackCustom', eventName, data);
    }

  }

  window.aiWidgetAnalytics = trackAnalytics;

  let messageQueue = [];
  let isOnline = navigator.onLine;

  function loadMessageQueue() {
    try {
      const stored = localStorage.getItem('ai_message_queue');
      if (stored) {
        messageQueue = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load message queue:', e);
    }
  }

  function saveMessageQueue() {
    try {
      localStorage.setItem('ai_message_queue', JSON.stringify(messageQueue));
    } catch (e) {
      console.error('Failed to save message queue:', e);
    }
  }

  function processMessageQueue() {
    if (!isOnline || messageQueue.length === 0) return;


    const queue = [...messageQueue];
    messageQueue = [];
    saveMessageQueue();

    queue.forEach(queuedMessage => {
      addMessageToChat('user', `${queuedMessage.message} 📤`);

      setTimeout(() => {
        sendMessageToServer(queuedMessage.message);
      }, 500);
    });
  }

  window.addEventListener('online', () => {
    isOnline = true;
    showNotification('Back online! Sending queued messages...', 'success');
    processMessageQueue();
  });

  window.addEventListener('offline', () => {
    isOnline = false;
    showNotification('You\'re offline. Messages will be queued.', 'info');
  });

  loadMessageQueue();

  function applySentimentStyling(sentiment) {
    const chatWidget = document.getElementById('ai-chat-widget');
    const chatHeader = document.querySelector('.ai-chat-header');
    const messagesContainer = document.getElementById('ai-chat-messages');

    if (!chatWidget) return;

    const sentimentStyles = {
      positive: {
        headerGradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', // Bright green
        headerShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
        messagesBg: '#f0fdf4', // Light green tint
        accentColor: '#10b981'
      },
      negative: {
        headerGradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', // Warm orange
        headerShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
        messagesBg: '#fffbeb', // Light warm tint
        accentColor: '#f59e0b'
      },
      neutral: {
        headerGradient: `linear-gradient(135deg, ${widgetSettings?.primaryColor || '#ee5cee'} 0%, ${adjustColor(widgetSettings?.primaryColor || '#ee5cee', -20)} 100%)`,
        headerShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        messagesBg: '#ffffff',
        accentColor: widgetSettings?.primaryColor || '#ee5cee'
      }
    };

    const style = sentimentStyles[sentiment] || sentimentStyles.neutral;

    if (chatHeader) {
      chatHeader.style.transition = 'all 0.5s ease';
      chatHeader.style.background = style.headerGradient;
      chatHeader.style.boxShadow = style.headerShadow;
    }

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

  function adjustColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255))
      .toString(16).slice(1);
  }

  const blockSettings = {
    enabled: {{ block.settings.enabled | json }},
    position: {{ block.settings.position | json }},
    buttonText: {{ block.settings.button_text | json }},
    chatTitle: {{ block.settings.chat_title | json }},
    statusText: {{ block.settings.status_text | json }},
    closeButtonLabel: {{ block.settings.close_button_label | json }},
    welcomeMessage: {{ block.settings.welcome_message | json }},
    inputPlaceholder: {{ block.settings.input_placeholder | json }},
    primaryColor: {{ block.settings.primary_color | json }},
    sectionDiscoveryLabel: {{ block.settings.section_discovery_label | json }},
    bestSellersText: {{ block.settings.best_sellers_text | json }},
    newArrivalsText: {{ block.settings.new_arrivals_text | json }},
    onSaleText: {{ block.settings.on_sale_text | json }},
    recommendationsText: {{ block.settings.recommendations_text | json }},
    sectionSupportLabel: {{ block.settings.section_support_label | json }},
    shippingText: {{ block.settings.shipping_text | json }},
    returnsText: {{ block.settings.returns_text | json }},
    trackOrderText: {{ block.settings.track_order_text | json }},
    helpText: {{ block.settings.help_text | json }}
  };
  
  window.toggleAIChat = function() {
    const chatWindow = document.getElementById('ai-chat-window');
    const toggleBtn = document.getElementById('ai-chat-toggle-btn');

    if (!chatWindow) {
      console.error('❌ AI Widget: Chat window not found!');
      return;
    }

    chatOpen = !chatOpen;

    trackAnalytics(chatOpen ? analyticsEvents.WIDGET_OPENED : analyticsEvents.WIDGET_CLOSED, {
      timestamp: new Date().toISOString(),
      conversationLength: conversationHistory.length
    });

    if (toggleBtn) {
      toggleBtn.setAttribute('aria-expanded', chatOpen.toString());
      toggleBtn.setAttribute('aria-label', chatOpen ? 'Close AI chat assistant' : 'Open AI chat assistant');
    }

    if (chatOpen) {
      chatWindow.classList.add('ai-chat-open');
    } else {
      chatWindow.classList.remove('ai-chat-open');
    }


    if (chatOpen) {
      const inputField = document.getElementById('ai-chat-input-field');
      if (inputField) {
        setTimeout(() => inputField.focus(), 200);
      }
      setTimeout(() => {
        scrollToTop();
      }, 250);
    } else {
      if (toggleBtn) {
        setTimeout(() => toggleBtn.focus(), 100);
      }
    }
  };
  
  window.handleChatKeyPress = function(event) {
    if (event.key === 'Enter') {
      sendAIMessage();
    }
  };
  
  window.sendAIMessage = function() {
    const inputField = document.getElementById('ai-chat-input-field');
    const message = inputField.value.trim();

    if (!message) return;

    trackAnalytics(analyticsEvents.MESSAGE_SENT, {
      messageLength: message.length,
      conversationPosition: conversationHistory.length + 1
    });

    if (!isOnline) {
      addMessageToChat('user', `${message} 📭 (Queued)`);
      messageQueue.push({
        message,
        timestamp: Date.now()
      });
      saveMessageQueue();
      inputField.value = '';
      showNotification('Message queued. Will send when online.', 'info');
      return;
    }

    hideWelcomeScreen();

    addMessageToChat('user', message);
    inputField.value = '';

    showLoading(true);
    
    const shopUrl = '{{ shop.url }}';
    
    const sendChatMessage = async () => {

      const detectedLocale = navigator.language || navigator.userLanguage || 'en';

      try {
        const contextData = {
          page: window.location.pathname,
          productId: getProductIdFromPage(),
          conversationHistory: conversationHistory,
          shopDomain: '{{ shop.myshopify_domain }}',
          locale: navigator.language || navigator.userLanguage || 'en',
          currency: '{{ shop.currency }}' || 'USD'
        };


        const response = await fetchWithRetry(`${shopUrl}/apps/widget-settings`, {
           method: 'POST',
           headers: {
             'Content-Type': 'application/json',
             'X-Shopify-Shop-Domain': '{{ shop.myshopify_domain }}',
             'X-Shopify-Customer-Access-Token': '{{ customer.access_token | default: "" }}',
           },
           body: JSON.stringify({
             userMessage: message,
             products: [],
             context: contextData
           })
         });

         return await response.json();
       } catch (error) {
         throw error;
       }
     };
     
     sendChatMessage()
      .then(data => {
      showLoading(false);

      let responseMessage = data.response || data.message;

      if (responseMessage) {
        trackAnalytics(analyticsEvents.MESSAGE_RECEIVED, {
          responseLength: responseMessage.length,
          hasRecommendations: !!(data.recommendations && data.recommendations.length > 0),
          hasSuggestions: !!(data.quickReplies && data.quickReplies.length > 0)
        });

        addMessageToChat('assistant', responseMessage);

        if (data.recommendations && data.recommendations.length > 0) {
          displayProductRecommendations(data.recommendations);
        }

        if (data.quickReplies && data.quickReplies.length > 0) {
          displayQuickReplies(data.quickReplies);
        } else {
          displayQuickReplies([]);
        }

        if (data.suggestedActions && data.suggestedActions.length > 0) {
          displaySuggestedActions(data.suggestedActions);
        } else {
          displaySuggestedActions([]);
        }

        if (data.sentiment) {
          currentSentiment = data.sentiment;
          applySentimentStyling(data.sentiment);
        }

        if (data.requiresHumanEscalation) {
          displayHumanEscalationPrompt();
        }

        conversationHistory.push(
          { role: 'user', content: message },
          { role: 'assistant', content: responseMessage }
        );

        if (conversationHistory.length > 10) {
          conversationHistory = conversationHistory.slice(-10);
        }

        saveConversationHistory();
      } else {
        addMessageToChat('assistant', 'Sorry, I encountered an error. Please try again.');
      }
    })
    .catch(error => {
      showLoading(false);
      console.error('AI Assistant Error:', error);

      trackAnalytics(analyticsEvents.ERROR_OCCURRED, {
        errorMessage: error.message,
        errorType: error.name
      });

      addMessageToChat('assistant', 'Sorry, I encountered an error. Please try again.');
    });
  };
  
  function addMessageToChat(sender, message) {
    const messagesContainer = document.getElementById('ai-chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `ai-message ${sender}-message`;

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';

    const cleanMessage = message.trim();
    const lines = cleanMessage.split('\n');

    lines.forEach((line, index) => {
      const textNode = document.createTextNode(line);
      messageContent.appendChild(textNode);

      if (index < lines.length - 1) {
        messageContent.appendChild(document.createElement('br'));
      }
    });

    messageDiv.appendChild(messageContent);
    messagesContainer.appendChild(messageDiv);

    scrollToBottom();
  }
  
  function scrollToBottom() {
    const messagesContainer = document.getElementById('ai-chat-messages');
    if (messagesContainer) {
      setTimeout(() => {
        messagesContainer.scrollTo({
          top: messagesContainer.scrollHeight,
          behavior: 'smooth'
        });
      }, 10);
    }
  }
  
  function scrollToTop() {
    const messagesContainer = document.getElementById('ai-chat-messages');
    if (messagesContainer) {
      setTimeout(() => {
        messagesContainer.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      }, 10);
    }
  }

  function displayQuickReplies(quickReplies) {
    if (!quickReplies || quickReplies.length === 0) {
      currentQuickReplies = [];
      const container = document.getElementById('quick-replies-container');
      if (container) container.remove();
      return;
    }

    currentQuickReplies = quickReplies;

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
        font-size: 14px;
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
        trackAnalytics(analyticsEvents.SUGGESTION_CLICKED, {
          suggestion: reply
        });

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
      currentSuggestedActions = [];
      const existingBar = document.getElementById('suggested-actions-bar');
      if (existingBar) existingBar.remove();
      return;
    }

    currentSuggestedActions = suggestedActions;

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
        font-size: 14px;
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

  function showNotification(message, type = 'success') {
    const existingNotif = document.getElementById('cart-notification');
    if (existingNotif) existingNotif.remove();

    const notification = document.createElement('div');
    notification.id = 'cart-notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#10b981' : '#ef4444'};
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 999999;
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 14px;
      font-weight: 600;
      animation: slideInRight 0.3s ease;
    `;

    const icon = document.createElement('span');
    icon.style.fontSize = '20px';
    icon.textContent = type === 'success' ? '✅' : '❌';
    notification.appendChild(icon);

    const text = document.createElement('span');
    text.textContent = message;
    notification.appendChild(text);

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  async function addToCart(productHandle, variantId, quantity = 1) {
    try {
      showNotification('Adding to cart...', 'info');

      if (variantId) {
        const response = await fetch('/cart/add.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            items: [{
              id: variantId,
              quantity: quantity
            }]
          })
        });

        if (!response.ok) {
          throw new Error('Failed to add to cart');
        }

        const data = await response.json();
        showNotification('Added to cart! 🛒', 'success');

        updateCartCount();
        return true;
      } else {
        const productResponse = await fetch(`/products/${productHandle}.js`);
        if (!productResponse.ok) {
          throw new Error('Product not found');
        }

        const product = await productResponse.json();
        const firstAvailableVariant = product.variants.find(v => v.available);

        if (!firstAvailableVariant) {
          throw new Error('Product is out of stock');
        }

        const addResponse = await fetch('/cart/add.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            items: [{
              id: firstAvailableVariant.id,
              quantity: quantity
            }]
          })
        });

        if (!addResponse.ok) {
          throw new Error('Failed to add to cart');
        }

        showNotification('Added to cart! 🛒', 'success');
        updateCartCount();
        return true;
      }
    } catch (error) {
      console.error('Cart error:', error);
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
      })
      .catch(err => console.error('Failed to update cart count:', err));
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

  function displayHumanEscalationPrompt() {
    const messagesContainer = document.getElementById('ai-chat-messages');
    if (!messagesContainer) return;

    const existingPrompt = document.getElementById('escalation-prompt');
    if (existingPrompt) return; // Don't show multiple times

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
    header.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    `;

    const icon = document.createElement('span');
    icon.style.fontSize = '28px';
    icon.textContent = '👤';
    header.appendChild(icon);

    const title = document.createElement('h3');
    title.style.cssText = `
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      color: #991b1b;
    `;
    title.textContent = 'Need to speak with a human?';
    header.appendChild(title);

    escalationPrompt.appendChild(header);

    const message = document.createElement('p');
    message.style.cssText = `
      margin: 0 0 16px 0;
      font-size: 14px;
      color: #7f1d1d;
      line-height: 1.5;
    `;
    message.textContent = 'It looks like you might need personalized assistance. Our support team is ready to help you!';
    escalationPrompt.appendChild(message);

    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    `;

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
      if (safeUrl) {
        window.open(safeUrl, '_blank', 'noopener,noreferrer');
      }
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

  function displayProductRecommendations(recommendations) {
    const messagesContainer = document.getElementById('ai-chat-messages');
    
    const productsContainer = document.createElement('div');
    productsContainer.className = 'ai-message assistant-message products-grid-container';
    productsContainer.style.marginBottom = '16px';
    productsContainer.style.maxWidth = '100%';
    productsContainer.style.width = '100%';
    
    const gridContent = document.createElement('div');
    gridContent.className = 'products-grid';
    gridContent.style.display = 'grid';
    gridContent.style.gridTemplateColumns = recommendations.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))';
    gridContent.style.gap = '12px';
    gridContent.style.padding = '0';
    gridContent.style.width = '100%';
    
    recommendations.forEach((product, index) => {
      const productCard = document.createElement('div');
      productCard.className = 'product-card clickable-product';
      productCard.style.backgroundColor = '#fff';
      productCard.style.border = '1px solid #e5e7eb';
      productCard.style.borderRadius = '12px';
      productCard.style.overflow = 'hidden';
      productCard.style.cursor = 'pointer';
      productCard.style.transition = 'all 0.3s ease';
      productCard.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
      productCard.style.position = 'relative';


      if (product.image) {
        const imageDiv = document.createElement('div');
        imageDiv.className = 'product-image';
        imageDiv.style.width = '100%';
        imageDiv.style.height = '160px';
        const sanitizedImageUrl = sanitizeUrl(product.image);
        if (sanitizedImageUrl) {
          const escapedUrl = sanitizedImageUrl.replace(/'/g, "\\'");
          imageDiv.style.backgroundImage = `url('${escapedUrl}')`;
        }
        imageDiv.style.backgroundSize = 'cover';
        imageDiv.style.backgroundPosition = 'center';
        imageDiv.style.backgroundColor = '#f8f9fa';
        imageDiv.style.position = 'relative';

        const badgesContainer = document.createElement('div');
        badgesContainer.style.position = 'absolute';
        badgesContainer.style.top = '8px';
        badgesContainer.style.left = '8px';
        badgesContainer.style.display = 'flex';
        badgesContainer.style.flexDirection = 'column';
        badgesContainer.style.gap = '6px';

        if (product.badge || product.discountPercent) {
          const discountBadge = document.createElement('div');
          discountBadge.style.background = '#ef4444';
          discountBadge.style.color = 'white';
          discountBadge.style.padding = '4px 10px';
          discountBadge.style.borderRadius = '6px';
          discountBadge.style.fontSize = '12px';
          discountBadge.style.fontWeight = '700';
          discountBadge.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
          discountBadge.textContent = product.badge || `${product.discountPercent}% OFF`;
          badgesContainer.appendChild(discountBadge);
        }

        if (product.isLowStock && product.inventory) {
          const stockBadge = document.createElement('div');
          stockBadge.style.background = '#f59e0b';
          stockBadge.style.color = 'white';
          stockBadge.style.padding = '4px 10px';
          stockBadge.style.borderRadius = '6px';
          stockBadge.style.fontSize = '11px';
          stockBadge.style.fontWeight = '600';
          stockBadge.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
          stockBadge.textContent = `Only ${product.inventory} left!`;
          badgesContainer.appendChild(stockBadge);
        }

        if (badgesContainer.children.length > 0) {
          imageDiv.appendChild(badgesContainer);
        }

        if (product.relevanceScore) {
          const matchBadge = document.createElement('div');
          matchBadge.style.position = 'absolute';
          matchBadge.style.top = '8px';
          matchBadge.style.right = '8px';
          matchBadge.style.background = 'rgba(0, 0, 0, 0.7)';
          matchBadge.style.color = 'white';
          matchBadge.style.padding = '4px 8px';
          matchBadge.style.borderRadius = '12px';
          matchBadge.style.fontSize = '11px';
          matchBadge.style.fontWeight = '600';
          matchBadge.style.backdropFilter = 'blur(4px)';
          matchBadge.textContent = `${product.relevanceScore}% match`;
          imageDiv.appendChild(matchBadge);
        }

        productCard.appendChild(imageDiv);
      }

      const detailsDiv = document.createElement('div');
      detailsDiv.style.padding = '16px';

      const titleH4 = document.createElement('h4');
      titleH4.style.margin = '0 0 8px 0';
      titleH4.style.fontSize = '16px';
      titleH4.style.fontWeight = '600';
      titleH4.style.color = '#1f2937';
      titleH4.style.lineHeight = '1.3';
      titleH4.style.display = '-webkit-box';
      titleH4.style.webkitLineClamp = '2';
      titleH4.style.webkitBoxOrient = 'vertical';
      titleH4.style.overflow = 'hidden';
      titleH4.textContent = product.title || 'Untitled Product'; // Safe textContent
      detailsDiv.appendChild(titleH4);

      if (product.rating || product.reviewCount) {
        const ratingDiv = document.createElement('div');
        ratingDiv.style.display = 'flex';
        ratingDiv.style.alignItems = 'center';
        ratingDiv.style.gap = '6px';
        ratingDiv.style.marginBottom = '8px';

        const rating = product.rating || 0;
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;

        const starsSpan = document.createElement('span');
        starsSpan.style.color = '#fbbf24';
        starsSpan.style.fontSize = '14px';
        starsSpan.textContent = '★'.repeat(fullStars) + (hasHalfStar ? '½' : '') + '☆'.repeat(5 - fullStars - (hasHalfStar ? 1 : 0));
        ratingDiv.appendChild(starsSpan);

        if (product.reviewCount) {
          const reviewSpan = document.createElement('span');
          reviewSpan.style.fontSize = '12px';
          reviewSpan.style.color = '#6b7280';
          reviewSpan.textContent = `(${product.reviewCount})`;
          ratingDiv.appendChild(reviewSpan);
        }

        detailsDiv.appendChild(ratingDiv);
      }

      const priceRow = document.createElement('div');
      priceRow.style.display = 'flex';
      priceRow.style.justifyContent = 'space-between';
      priceRow.style.alignItems = 'center';
      priceRow.style.marginBottom = '12px';

      const priceContainer = document.createElement('div');
      priceContainer.style.display = 'flex';
      priceContainer.style.flexDirection = 'column';
      priceContainer.style.gap = '2px';

      if (product.compareAtPrice && parseFloat(product.compareAtPrice) > parseFloat(product.price)) {
        const originalPriceSpan = document.createElement('span');
        originalPriceSpan.style.fontSize = '13px';
        originalPriceSpan.style.color = '#9ca3af';
        originalPriceSpan.style.textDecoration = 'line-through';
        originalPriceSpan.textContent = `$${parseFloat(product.compareAtPrice).toFixed(2)}`;
        priceContainer.appendChild(originalPriceSpan);
      }

      const priceDiv = document.createElement('div');
      priceDiv.style.fontSize = '20px';
      priceDiv.style.fontWeight = '700';
      priceDiv.style.color = product.compareAtPrice ? '#ef4444' : widgetSettings.primaryColor;
      priceDiv.textContent = product.priceFormatted || `$${parseFloat(product.price || '0').toFixed(2)}`;
      priceContainer.appendChild(priceDiv);

      priceRow.appendChild(priceContainer);

      if (product.category) {
        const categoryDiv = document.createElement('div');
        categoryDiv.style.background = '#f3f4f6';
        categoryDiv.style.color = '#6b7280';
        categoryDiv.style.padding = '2px 8px';
        categoryDiv.style.borderRadius = '8px';
        categoryDiv.style.fontSize = '11px';
        categoryDiv.style.fontWeight = '500';
        categoryDiv.textContent = product.category; // Safe textContent
        priceRow.appendChild(categoryDiv);
      }
      detailsDiv.appendChild(priceRow);

      const descP = document.createElement('p');
      descP.style.margin = '0 0 12px 0';
      descP.style.fontSize = '13px';
      descP.style.color = '#6b7280';
      descP.style.lineHeight = '1.4';
      descP.style.display = '-webkit-box';
      descP.style.webkitLineClamp = '3';
      descP.style.webkitBoxOrient = 'vertical';
      descP.style.overflow = 'hidden';
      descP.textContent = product.description || 'No description available'; // Safe textContent
      detailsDiv.appendChild(descP);

      if (product.urgencyMessage) {
        const urgencyDiv = document.createElement('div');
        urgencyDiv.style.display = 'flex';
        urgencyDiv.style.alignItems = 'center';
        urgencyDiv.style.gap = '6px';
        urgencyDiv.style.background = '#fef3c7';
        urgencyDiv.style.color = '#92400e';
        urgencyDiv.style.padding = '8px 12px';
        urgencyDiv.style.borderRadius = '8px';
        urgencyDiv.style.fontSize = '12px';
        urgencyDiv.style.fontWeight = '600';
        urgencyDiv.style.marginBottom = '12px';
        urgencyDiv.style.border = '1px solid #fcd34d';

        const iconSpan = document.createElement('span');
        iconSpan.textContent = '⚡';
        iconSpan.style.fontSize = '14px';
        urgencyDiv.appendChild(iconSpan);

        const textSpan = document.createElement('span');
        textSpan.textContent = product.urgencyMessage;
        urgencyDiv.appendChild(textSpan);

        detailsDiv.appendChild(urgencyDiv);
      }

      if (product.tags && product.tags.length > 0) {
        const tagsDiv = document.createElement('div');
        tagsDiv.style.marginBottom = '12px';

        product.tags.slice(0, 3).forEach(tag => {
          const tagSpan = document.createElement('span');
          tagSpan.style.display = 'inline-block';
          tagSpan.style.background = '#e5e7eb';
          tagSpan.style.color = '#374151';
          tagSpan.style.padding = '2px 6px';
          tagSpan.style.borderRadius = '6px';
          tagSpan.style.fontSize = '10px';
          tagSpan.style.marginRight = '4px';
          tagSpan.style.marginBottom = '4px';
          tagSpan.textContent = tag; // Safe textContent
          tagsDiv.appendChild(tagSpan);
        });

        detailsDiv.appendChild(tagsDiv);
      }

      const actionButton = document.createElement('div');
      actionButton.style.background = widgetSettings.primaryColor;
      actionButton.style.color = 'white';
      actionButton.style.textAlign = 'center';
      actionButton.style.padding = '10px';
      actionButton.style.borderRadius = '8px';
      actionButton.style.fontSize = '14px';
      actionButton.style.fontWeight = '600';
      actionButton.style.marginTop = 'auto';
      actionButton.textContent = 'View Product →';
      detailsDiv.appendChild(actionButton);

      productCard.appendChild(detailsDiv);
      
      productCard.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();

        trackAnalytics(analyticsEvents.PRODUCT_CLICKED, {
          productTitle: product.title,
          productHandle: product.handle,
          productPrice: product.price,
          relevanceScore: product.relevanceScore
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
        this.style.transform = 'translateY(-4px)';
        this.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.15)';
      });
      
      productCard.addEventListener('mouseleave', function() {
        this.style.borderColor = '#e5e7eb';
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
      });
      
      gridContent.appendChild(productCard);
    });
    
    productsContainer.appendChild(gridContent);
    messagesContainer.appendChild(productsContainer);
    
    if (recommendations.length > 2) {
      const browseMoreDiv = document.createElement('div');
      browseMoreDiv.className = 'ai-message assistant-message';
      browseMoreDiv.style.marginTop = '8px';
      browseMoreDiv.style.textAlign = 'center';
      
      const browseButton = document.createElement('button');
      browseButton.style.background = 'transparent';
      browseButton.style.border = `2px solid ${widgetSettings.primaryColor}`;
      browseButton.style.color = widgetSettings.primaryColor;
      browseButton.style.padding = '10px 20px';
      browseButton.style.borderRadius = '25px';
      browseButton.style.fontSize = '14px';
      browseButton.style.fontWeight = '600';
      browseButton.style.cursor = 'pointer';
      browseButton.style.transition = 'all 0.2s ease';
      browseButton.textContent = 'Browse All Products';
      
      browseButton.addEventListener('click', function() {
        const safeUrl = sanitizeUrl('/collections/all');
        if (safeUrl) {
          window.open(safeUrl, '_blank', 'noopener,noreferrer');
        }
      });
      
      browseButton.addEventListener('mouseenter', function() {
        this.style.backgroundColor = widgetSettings.primaryColor;
        this.style.color = 'white';
      });
      
      browseButton.addEventListener('mouseleave', function() {
        this.style.backgroundColor = 'transparent';
        this.style.color = widgetSettings.primaryColor;
      });
      
      browseMoreDiv.appendChild(browseButton);
      messagesContainer.appendChild(browseMoreDiv);
    }
    
    scrollToBottom();
  }
  
  function showLoading(show) {
    const messagesContainer = document.getElementById('ai-chat-messages');
    let loadingDiv = document.getElementById('ai-loading');

    if (show) {
      if (loadingDiv) {
        loadingDiv.remove();
      }

      loadingDiv = document.createElement('div');
      loadingDiv.id = 'ai-loading';
      loadingDiv.className = 'ai-message assistant-message skeleton-message';

      for (let i = 0; i < 3; i++) {
        const line = document.createElement('div');
        line.className = 'skeleton skeleton-line';
        line.style.width = i === 2 ? '60%' : '100%';
        loadingDiv.appendChild(line);
      }

      if (messagesContainer) {
        const allMessages = messagesContainer.querySelectorAll('.ai-message:not(.ai-welcome-message)');

        if (allMessages.length > 0) {
          const lastMessage = allMessages[allMessages.length - 1];
          lastMessage.insertAdjacentElement('afterend', loadingDiv);
        } else {
          messagesContainer.appendChild(loadingDiv);
        }

        scrollToBottom();
      }
    } else {
      if (loadingDiv) {
        loadingDiv.style.opacity = '0';
        loadingDiv.style.transition = 'opacity 0.3s ease';
        setTimeout(() => loadingDiv.remove(), 300);
      }
    }
  }
  
  function hideWelcomeScreen() {
    const welcomeMessage = document.querySelector('.ai-welcome-message');
    if (welcomeMessage) {
      welcomeMessage.style.display = 'none';
    }
  }
  
  function getProductIdFromPage() {
    const productMatch = window.location.pathname.match(/\/products\/([^\/]+)/);
    if (productMatch) {
      return productMatch[1];
    }
    return null;
  }
  
  async function initializeWidget() {
    try {
      loadConversationHistory();

      widgetSettings = blockSettings;

      
      const shopDomain = window.Shopify?.shop || '{{ shop.permanent_domain }}';
      const shopUrl = '{{ shop.url }}';
      const possibleSettingsUrls = [
        shopUrl + '/apps/widget-settings',
        window.location.protocol + '//' + window.location.host + '/apps/widget-settings'
      ];
      
      let apiSuccess = false;
      for (const appUrl of possibleSettingsUrls) {
        try {
          const timestamp = Date.now();
          const response = await fetchWithRetry(`${appUrl}?shop=${shopDomain}&t=${timestamp}`, {}, 2);
          const data = await response.json();

          const isThemeEditor = !!(
            window.Shopify?.designMode ||
            window.location.search.includes('oseid=') ||
            window.location.pathname.includes('/editor')
          );

            'Shopify.designMode': window.Shopify?.designMode,
            'URL has oseid': window.location.search.includes('oseid='),
            'Is theme editor': isThemeEditor
          });

          if (isThemeEditor) {
            widgetSettings = { ...data.settings, ...blockSettings };  // Theme editor: block settings override
          } else {
            widgetSettings = { ...blockSettings, ...data.settings }; // Storefront: API settings override
          }
          apiSuccess = true;

          if (typeof window.lastSettingsUpdate === 'undefined') {
            window.lastSettingsUpdate = data.settings.updatedAt;
          }
          break;
        } catch (e) {
          continue;
        }
      }
      
      if (!apiSuccess) {
      }
      
      
      if (!widgetSettings.enabled) {
        return;
      }
      
      createWidget();
      
        position: widgetSettings.position,
        primaryColor: widgetSettings.primaryColor,
        buttonText: widgetSettings.buttonText,
        chatTitle: widgetSettings.chatTitle
      });
      
    } catch (error) {
      console.error('Failed to load AI Sales Assistant settings:', error);
      widgetSettings = blockSettings;
      if (widgetSettings.enabled) {
        createWidget();
      }
    }
  }
  
  function createWidget() {
    const container = document.getElementById('ai-sales-assistant-container');
    if (!container || !widgetSettings) return;
    
    
    container.innerHTML = '';
    
    const safePosition = String(widgetSettings.position).replace(/[^a-z-]/gi, ''); // Only allow letters and hyphens
    const safeButtonText = escapeHTML(widgetSettings.buttonText);
    const safeChatTitle = escapeHTML(widgetSettings.chatTitle);
    const safeWelcomeMessage = escapeHTML(widgetSettings.welcomeMessage);
    const safeInputPlaceholder = escapeHTML(widgetSettings.inputPlaceholder);
    const safePrimaryColor = sanitizeColor(widgetSettings.primaryColor);

    container.innerHTML = `
      <div class="ai-sales-assistant-widget position-${safePosition}" data-widget-id="ai-sales-assistant">
        <!-- Chat Toggle Button -->
        <button
          class="ai-chat-toggle"
          id="ai-chat-toggle-btn"
          style="background-color: ${safePrimaryColor};"
          aria-label="Open AI chat assistant"
          aria-expanded="false"
          aria-controls="ai-chat-window"
        >
          <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAABJlBMVEVHcEwb49o9s+I0v+BIoOUuyN9Ui+hZg+pdfOsc49tMl+ZViuke4NtOk+ce39sc4ts3t+Ej19xbf+pTi+gl1N1GoOVCp+RWh+kxwuAa5tpFo+Ue39s0vuAsyt4i2NxIneYpzd5Ml+Yry946suJUiuldfOs6suIc49oZ59oa5do/q+Neeusxwt8Y6dka5touxt88sOJcfupZgupcfuo0veBefOpcfuoZ5toiIiI8sOI2ueFCp+RFouVInuU5tOE/q+MzveAxwt8uxt9LmedQkOdWh+kry98o0N0hHx9Ui+gl1Nwi2dwf3dtOlOZZgulcfuomTFYsRFcrhZc+ZpxUjes4cJsyepkjP0Ei2t0lxs1ImOBPluomy9ZEcbFBo95KgMsmmaIkZ2ysswjsAAAAOHRSTlMA/gUPAic0C7FTd1yYJhPx7WN0zOqTseDK3t/QnT6GGbzjS7idmjlKO63ujvUwzvf08Ty8eiXh80ZVzqoAAAFYSURBVDjLvZPXVsJAEIYpgST0DlIEFAQLFiw0KUGECKJIVECxvf9LaHZmMBG88/hdzX/mO7t7dnYNhv/FVciJYt5iWt015R37bqPRWFrb9rpW9AsOtQuUYuLSKrnYtRb3ulnfFwMDxnQ6hWLg0BmJQJ/Rm81mcyj765zm9Kke8D6ZTD7mUAc2vgVvF+iNZVketTGlFpuYI22gOy6X5ZGE6WCxRGJPAtpMaGGS4iSctBCJCVWKEdyDi1cJJjQoeSx4x5sNpPqoChWKni0SKgQTmpQOUeBCTYQJdzWKO7iFIVgjHlThlVI0iYL9nGBCnVKIRuqM1hEmPFGy0T1wwQsEBAxp52IW1vSQ8ayoQgfC0KYZt60DvCmK8oK1P6kR+MwVcP8FVGGr7kWZM5d6/MUfb5L3hW80CM7lZ23Nnt0CR8d2ftXH4E7tu4IgZH1F/ve/xZlMf/5fPwFR8XwfQCSWdQAAAABJRU5ErkJggg==" alt="iHeard.ai" width="24" height="24" style="object-fit: contain;" />
          <span class="button-text">${safeButtonText}</span>
        </button>

        <!-- Chat Window -->
        <div
          id="ai-chat-window"
          class="ai-chat-window"
          style="display: none;"
          role="dialog"
          aria-labelledby="ai-chat-title"
          aria-modal="true"
        >
          <!-- Chat Header with Wavy Bottom Edge -->
          <div class="ai-chat-header">
            <div class="chat-header-content">
              <div class="header-info">
                <h3 id="ai-chat-title">${safeChatTitle}</h3>
                <div class="header-status">
                  <span class="status-dot"></span>
                  <span class="status-text">${escapeHTML(widgetSettings.statusText || 'Online')}</span>
                </div>
              </div>
              <button
                class="ai-chat-close"
                id="ai-chat-close-btn"
                aria-label="${escapeHTML(widgetSettings.closeButtonLabel || 'Close')}"
                title="Close chat (Esc)"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M13.5 4.5L4.5 13.5M4.5 4.5L13.5 13.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
            <!-- Wavy bottom edge -->
            <div class="header-wave-bottom">
              <svg viewBox="0 0 1200 40" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0,20 C150,0 350,40 600,20 C850,0 1050,40 1200,20 L1200,40 L0,40 Z" fill="white"/>
              </svg>
            </div>
          </div>
          
          <!-- Chat Messages Container -->
          <div class="ai-chat-messages-container">
            <!-- Chat Messages -->
            <div
              id="ai-chat-messages"
              class="ai-chat-messages"
              role="log"
              aria-live="polite"
              aria-atomic="false"
              aria-label="Chat messages"
            >
              <div class="ai-message assistant-message ai-welcome-message" style="margin-bottom: 16px !important; margin-top: 0px !important; display: block !important; max-width: 100% !important; width: 100% !important;">
                <div class="ai-welcome-screen" style="background: transparent; padding: 0;">
                  <!-- Welcome Header -->
                  <div class="welcome-header">
                    <div class="welcome-avatar">
                      <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAABJlBMVEVHcEwb49o9s+I0v+BIoOUuyN9Ui+hZg+pdfOsc49tMl+ZViuke4NtOk+ce39sc4ts3t+Ej19xbf+pTi+gl1N1GoOVCp+RWh+kxwuAa5tpFo+Ue39s0vuAsyt4i2NxIneYpzd5Ml+Yry946suJUiuldfOs6suIc49oZ59oa5do/q+Neeusxwt8Y6dka5touxt88sOJcfupZgupcfuo0veBefOpcfuoZ5toiIiI8sOI2ueFCp+RFouVInuU5tOE/q+MzveAxwt8uxt9LmedQkOdWh+kry98o0N0hHx9Ui+gl1Nwi2dwf3dtOlOZZgulcfuomTFYsRFcrhZc+ZpxUjes4cJsyepkjP0Ei2t0lxs1ImOBPluomy9ZEcbFBo95KgMsmmaIkZ2ysswjsAAAAOHRSTlMA/gUPAic0C7FTd1yYJhPx7WN0zOqTseDK3t/QnT6GGbzjS7idmjlKO63ujvUwzvf08Ty8eiXh80ZVzqoAAAFYSURBVDjLvZPXVsJAEIYpgST0DlIEFAQLFiw0KUGECKJIVECxvf9LaHZmMBG88/hdzX/mO7t7dnYNhv/FVciJYt5iWt015R37bqPRWFrb9rpW9AsOtQuUYuLSKrnYtRb3ulnfFwMDxnQ6hWLg0BmJQJ/Rm81mcyj765zm9Kke8D6ZTD7mUAc2vgVvF+iNZVketTGlFpuYI22gOy6X5ZGE6WCxRGJPAtpMaGGS4iSctBCJCVWKEdyDi1cJJjQoeSx4x5sNpPqoChWKni0SKgQTmpQOUeBCTYQJdzWKO7iFIVgjHlThlVI0iYL9nGBCnVKIRuqM1hEmPFGy0T1wwQsEBAxp52IW1vSQ8ayoQgfC0KYZt60DvCmK8oK1P6kR+MwVcP8FVGGr7kWZM5d6/MUfb5L3hW80CM7lZ23Nnt0CR8d2ftXH4E7tu4IgZH1F/ve/xZlMf/5fPwFR8XwfQCSWdQAAAABJRU5ErkJggg==" alt="AI" width="32" height="32" />
                    </div>
                    <h2 class="welcome-title">${safeWelcomeMessage}</h2>
                  </div>

                  <!-- Product Discovery Section -->
                  <div class="quick-actions-section">
                    <div class="section-label">
                      <span>${escapeHTML(widgetSettings.sectionDiscoveryLabel || 'Product Discovery')}</span>
                    </div>
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
                        <span class="quick-action-text">${escapeHTML(widgetSettings.recommendationsText || 'For You')}</span>
                      </button>
                    </div>
                  </div>

                  <!-- Customer Support Section -->
                  <div class="quick-actions-section">
                    <div class="section-label">
                      <span>${escapeHTML(widgetSettings.sectionSupportLabel || 'Customer Support')}</span>
                    </div>
                    <div class="quick-actions-grid">
                      <button class="quick-action-btn" data-prompt="Tell me about shipping and delivery">
                        <span class="quick-action-icon">📦</span>
                        <span class="quick-action-text">${escapeHTML(widgetSettings.shippingText || 'Shipping Info')}</span>
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
                        <span class="quick-action-text">${escapeHTML(widgetSettings.helpText || 'Help & FAQ')}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              

            </div>
          </div>
          
          <!-- Chat Input -->
          <div class="ai-chat-input">
            <div class="ai-chat-input-wrapper">
              <label for="ai-chat-input-field" class="sr-only">Type your message</label>
              <input
                type="text"
                id="ai-chat-input-field"
                placeholder="${safeInputPlaceholder}"
                aria-label="Type your message"
                aria-describedby="ai-powered-footer"
              />
              <button
                id="ai-chat-send-btn"
                aria-label="Send message"
                title="Send message (Enter)"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M18 2L9 11M18 2L12 18L9 11M18 2L2 8L9 11" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
            <div id="ai-powered-footer" class="ai-powered-footer">Powered by AI</div>
          </div>
        </div>
      </div>
    `;
    
    addWidgetStyles();
    
    setTimeout(() => {
      setupEventListeners();
    }, 50);
  }
  
  function addWidgetStyles() {
    if (document.getElementById('ai-widget-styles')) return;

    document.documentElement.style.setProperty('--ai-primary-color', widgetSettings.primaryColor);

    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    };

    const rgb = hexToRgb(widgetSettings.primaryColor);
    if (rgb) {
      const darkerR = Math.max(0, rgb.r - 40);
      const darkerG = Math.max(0, rgb.g - 40);
      const darkerB = Math.max(0, rgb.b - 40);
      const darkerColor = `rgb(${darkerR}, ${darkerG}, ${darkerB})`;
      document.documentElement.style.setProperty('--ai-primary-color-dark', darkerColor);
      document.documentElement.style.setProperty('--ai-primary-color-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    }

    const style = document.createElement('style');
    style.id = 'ai-widget-styles';
    document.head.appendChild(style);
  }
  
  function setupEventListeners() {
    
    window.aiWidgetHandlers = window.aiWidgetHandlers || {};
    
    const toggleBtn = document.getElementById('ai-chat-toggle-btn');
    if (toggleBtn) {
      if (window.aiWidgetHandlers.toggleHandler) {
        toggleBtn.removeEventListener('click', window.aiWidgetHandlers.toggleHandler);
      }
      
      window.aiWidgetHandlers.toggleHandler = function(e) {
        e.preventDefault();
        e.stopPropagation();
        toggleAIChat();
      };
      
      toggleBtn.addEventListener('click', window.aiWidgetHandlers.toggleHandler);
    } else {
      console.warn('⚠️ AI Widget: Toggle button not found');
    }
    
    const closeBtn = document.getElementById('ai-chat-close-btn');
    if (closeBtn) {
      if (window.aiWidgetHandlers.closeHandler) {
        closeBtn.removeEventListener('click', window.aiWidgetHandlers.closeHandler);
      }
      
      window.aiWidgetHandlers.closeHandler = function(e) {
        e.preventDefault();
        e.stopPropagation();
        toggleAIChat();
      };
      
      closeBtn.addEventListener('click', window.aiWidgetHandlers.closeHandler);
    } else {
      console.warn('⚠️ AI Widget: Close button not found');
    }
    
    const sendBtn = document.getElementById('ai-chat-send-btn');
    if (sendBtn) {
      if (window.aiWidgetHandlers.sendHandler) {
        sendBtn.removeEventListener('click', window.aiWidgetHandlers.sendHandler);
      }
      
      window.aiWidgetHandlers.sendHandler = function(e) {
        e.preventDefault();
        e.stopPropagation();
        sendAIMessage();
      };
      
      sendBtn.addEventListener('click', window.aiWidgetHandlers.sendHandler);
    } else {
      console.warn('⚠️ AI Widget: Send button not found');
    }
    
    const inputField = document.getElementById('ai-chat-input-field');
    if (inputField) {
      if (window.aiWidgetHandlers.keyHandler) {
        inputField.removeEventListener('keypress', window.aiWidgetHandlers.keyHandler);
      }
      
      window.aiWidgetHandlers.keyHandler = function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          sendAIMessage();
        }
      };
      
      inputField.addEventListener('keypress', window.aiWidgetHandlers.keyHandler);
    } else {
      console.warn('⚠️ AI Widget: Input field not found');
    }

    window.aiWidgetHandlers.escapeHandler = function(e) {
      if (e.key === 'Escape' && chatOpen) {
        e.preventDefault();
        toggleAIChat();
      }
    };
    document.addEventListener('keydown', window.aiWidgetHandlers.escapeHandler);

    window.aiWidgetHandlers.focusTrapHandler = function(e) {
      if (!chatOpen) return;

      const chatWindow = document.getElementById('ai-chat-window');
      if (!chatWindow) return;

      const focusableElements = chatWindow.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
        else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };
    document.addEventListener('keydown', window.aiWidgetHandlers.focusTrapHandler);

    const suggestionBtns = document.querySelectorAll('.suggestion-btn, .quick-action-btn');
    suggestionBtns.forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const prompt = this.getAttribute('data-prompt');
        if (prompt) {
          const inputField = document.getElementById('ai-chat-input-field');
          if (inputField) {
            inputField.value = prompt;
            sendAIMessage();
          }
        }
      });
    });
    
    if (!window.aiWidgetHandlers.outsideClickHandler) {
      window.aiWidgetHandlers.outsideClickHandler = function(e) {
        const chatWindow = document.getElementById('ai-chat-window');
        const widget = document.querySelector('.ai-sales-assistant-widget');
        
        if (chatOpen && chatWindow && widget && !widget.contains(e.target)) {
          toggleAIChat();
        }
      };
      
      document.addEventListener('click', window.aiWidgetHandlers.outsideClickHandler);
    }
  }
  
  window.refreshAIWidget = async function() {
    await initializeWidget();
  };
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWidget);
  } else {
    initializeWidget();
  }
  
  let workingApiUrl = null; // Cache the working URL to avoid testing all URLs every time

  settingsCheckInterval = setInterval(async () => {
    try {
      const shopDomain = window.Shopify?.shop || '{{ shop.permanent_domain }}';
      const urlsToTry = workingApiUrl ? [workingApiUrl] : [
        '{{ shop.url }}' + '/apps/widget-settings',
        window.location.protocol + '//' + window.location.host + '/apps/widget-settings'
      ];

      for (const url of urlsToTry) {
        try {
          const response = await fetchWithRetry(`${url}?shop=${shopDomain}&t=${Date.now()}`, {}, 1);
          const data = await response.json();
          const currentUpdate = data.settings.updatedAt;

          if (!workingApiUrl) workingApiUrl = url;

          if (window.lastSettingsUpdate && currentUpdate !== window.lastSettingsUpdate) {
              old: window.lastSettingsUpdate,
              new: currentUpdate,
              newSettings: data.settings
            });
            widgetSettings = { ...blockSettings, ...data.settings };
            createWidget();
          }
          window.lastSettingsUpdate = currentUpdate;
          break; // Success, stop trying other URLs
        } catch (e) {
          if (url === workingApiUrl) workingApiUrl = null;
          continue;
        }
      }
    } catch (e) {
    }
  }, 300000); // 5 minutes (300,000ms) - much more reasonable for production
})();
