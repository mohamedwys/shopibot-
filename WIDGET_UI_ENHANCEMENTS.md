# Widget UI Enhancements Guide
## Phase 2: Rich Response Display

This document contains all the UI components needed to display rich N8N responses in the Shopibot widget.

---

## 🎯 Components to Add

### 1. Quick Replies Component
### 2. Suggested Actions Bar
### 3. Enhanced Product Cards (with badges, urgency, discount prices)
### 4. Shopify Cart Integration
### 5. Sentiment-Based Styling

---

## 📦 Component 1: Quick Replies

Add this code **AFTER** the chat input field (search for `<input id="ai-chat-input-field"` and add after the input container):

```javascript
// Global variable for quick replies
let currentQuickReplies = [];

// Function to display quick replies
function displayQuickReplies(quickReplies) {
  if (!quickReplies || quickReplies.length === 0) {
    currentQuickReplies = [];
    const container = document.getElementById('quick-replies-container');
    if (container) container.remove();
    return;
  }

  currentQuickReplies = quickReplies;

  // Remove existing quick replies
  const existingContainer = document.getElementById('quick-replies-container');
  if (existingContainer) existingContainer.remove();

  // Create quick replies container
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

  // Create quick reply buttons
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

    // Hover effect
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

    // Click handler
    button.onclick = () => {
      const inputField = document.getElementById('ai-chat-input-field');
      if (inputField) {
        inputField.value = reply;
        sendAIMessage();
      }
    };

    container.appendChild(button);
  });

  // Insert before the input field
  const chatFooter = document.querySelector('.ai-chat-footer') ||
                     document.getElementById('ai-chat-input-field')?.parentElement;
  if (chatFooter) {
    chatFooter.insertBefore(container, chatFooter.firstChild);
  }
}
```

---

## 📦 Component 2: Suggested Actions Bar

Add this function to handle suggested actions:

```javascript
// Function to display suggested actions
function displaySuggestedActions(actions) {
  if (!actions || actions.length === 0) return;

  // Remove existing actions
  const existing = document.getElementById('suggested-actions-container');
  if (existing) existing.remove();

  // Create container
  const container = document.createElement('div');
  container.id = 'suggested-actions-container';
  container.className = 'ai-message assistant-message';
  container.style.cssText = `
    margin: 12px 0;
    padding: 16px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.25);
  `;

  const title = document.createElement('div');
  title.textContent = '💡 Quick Actions';
  title.style.cssText = `
    color: white;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 12px;
    opacity: 0.9;
  `;
  container.appendChild(title);

  const buttonsContainer = document.createElement('div');
  buttonsContainer.style.cssText = `
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  `;

  actions.forEach(action => {
    const button = document.createElement('button');
    button.textContent = action.label;
    button.style.cssText = `
      background: white;
      color: #667eea;
      border: none;
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;

    button.onmouseover = () => {
      button.style.transform = 'translateY(-2px)';
      button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
    };
    button.onmouseout = () => {
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    };

    button.onclick = () => handleSuggestedAction(action);
    buttonsContainer.appendChild(button);
  });

  container.appendChild(buttonsContainer);

  // Insert into chat messages
  const messagesContainer = document.getElementById('ai-chat-messages');
  if (messagesContainer) {
    messagesContainer.appendChild(container);
    scrollToBottom();
  }
}

// Handle suggested action clicks
function handleSuggestedAction(action) {
  switch(action.action) {
    case 'view_product':
      if (action.data) {
        const shopUrl = '{{ shop.url }}';
        const productUrl = `${shopUrl}/products/${action.data}`;
        window.open(productUrl, '_blank');
      }
      break;

    case 'add_to_cart':
      if (action.data) {
        addToShopifyCart(action.data, 1);
      }
      break;

    case 'compare':
      // For now, just show a message
      addMessageToChat('assistant', 'Product comparison feature coming soon! For now, you can view each product individually.');
      break;

    default:
      console.log('Unknown action:', action);
  }
}
```

---

## 📦 Component 3: Enhanced Product Cards

**REPLACE** the existing `displayProductRecommendations` function with this enhanced version:

```javascript
// Enhanced product recommendations display
function displayProductRecommendations(recommendations) {
  if (!recommendations || recommendations.length === 0) return;

  const messagesContainer = document.getElementById('ai-chat-messages');

  // Container for all cards
  const productsContainer = document.createElement('div');
  productsContainer.className = 'ai-message assistant-message products-grid-container';
  productsContainer.style.cssText = `
    margin: 16px 0;
    max-width: 100%;
    width: 100%;
  `;

  const gridContent = document.createElement('div');
  gridContent.className = 'products-grid';
  gridContent.style.cssText = `
    display: grid;
    grid-template-columns: ${recommendations.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))'};
    gap: 16px;
    padding: 0;
    width: 100%;
  `;

  recommendations.forEach((product) => {
    const card = createEnhancedProductCard(product);
    gridContent.appendChild(card);
  });

  productsContainer.appendChild(gridContent);
  messagesContainer.appendChild(productsContainer);
  scrollToBottom();
}

// Create enhanced product card with badges, urgency, discounts
function createEnhancedProductCard(product) {
  const card = document.createElement('div');
  card.className = 'product-card enhanced-product-card';
  card.style.cssText = `
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 16px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    position: relative;
  `;

  // Hover effect
  card.onmouseover = () => {
    card.style.transform = 'translateY(-4px)';
    card.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.15)';
  };
  card.onmouseout = () => {
    card.style.transform = 'translateY(0)';
    card.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
  };

  // Image section
  const imageSection = createProductImageSection(product);
  card.appendChild(imageSection);

  // Details section
  const detailsSection = createProductDetailsSection(product);
  card.appendChild(detailsSection);

  // Urgency message (if applicable)
  if (product.urgencyMessage) {
    const urgencyDiv = document.createElement('div');
    urgencyDiv.style.cssText = `
      padding: 8px 16px;
      background: linear-gradient(135deg, #fef3c7, #fde68a);
      border-top: 1px solid #fbbf24;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      color: #92400e;
    `;
    urgencyDiv.innerHTML = `
      <span style="font-size: 16px;">⚠️</span>
      <span>${escapeHTML(product.urgencyMessage)}</span>
    `;
    card.appendChild(urgencyDiv);
  }

  // Action buttons
  const actionsSection = createProductActionButtons(product);
  card.appendChild(actionsSection);

  return card;
}

// Create product image section with badge
function createProductImageSection(product) {
  const imageDiv = document.createElement('div');
  imageDiv.style.cssText = `
    width: 100%;
    height: 200px;
    position: relative;
    background-color: #f8f9fa;
    background-size: cover;
    background-position: center;
    ${product.image ? `background-image: url('${product.image}');` : ''}
  `;

  // Badge (discount or low stock)
  if (product.badge) {
    const badge = document.createElement('div');
    badge.textContent = product.badge;

    // Different colors for different badge types
    let badgeBg = '#ef4444'; // Default red
    if (product.badge.includes('%')) badgeBg = '#ef4444'; // Discount: red
    if (product.badge.includes('Stock')) badgeBg = '#f59e0b'; // Low stock: orange
    if (product.badge.includes('Best')) badgeBg = '#10b981'; // Best seller: green

    badge.style.cssText = `
      position: absolute;
      top: 12px;
      right: 12px;
      background: ${badgeBg};
      color: white;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 2;
    `;
    imageDiv.appendChild(badge);
  }

  // Relevance score badge
  if (product.relevanceScore && product.relevanceScore >= 70) {
    const scoreBadge = document.createElement('div');
    scoreBadge.textContent = `${product.relevanceScore}% Match`;
    scoreBadge.style.cssText = `
      position: absolute;
      top: 12px;
      left: 12px;
      background: rgba(102, 126, 234, 0.95);
      color: white;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      z-index: 2;
    `;
    imageDiv.appendChild(scoreBadge);
  }

  // Availability overlay
  if (!product.isAvailable) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 600;
      font-size: 16px;
      z-index: 1;
    `;
    overlay.textContent = 'Out of Stock';
    imageDiv.appendChild(overlay);
  }

  return imageDiv;
}

// Create product details section
function createProductDetailsSection(product) {
  const detailsDiv = document.createElement('div');
  detailsDiv.style.padding = '16px';

  // Title
  const title = document.createElement('h4');
  title.style.cssText = `
    margin: 0 0 12px 0;
    font-size: 16px;
    font-weight: 600;
    color: #1f2937;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  `;
  title.textContent = product.title;
  detailsDiv.appendChild(title);

  // Price section
  const priceContainer = document.createElement('div');
  priceContainer.style.cssText = `
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 12px;
  `;

  const currentPrice = document.createElement('span');
  currentPrice.textContent = product.priceFormatted || `$${product.price}`;
  currentPrice.style.cssText = `
    font-size: 20px;
    font-weight: 700;
    color: ${widgetSettings.primaryColor || '#ee5cee'};
  `;
  priceContainer.appendChild(currentPrice);

  // Original price (if discounted)
  if (product.compareAtPrice && parseFloat(product.compareAtPrice) > parseFloat(product.price)) {
    const originalPrice = document.createElement('span');
    originalPrice.textContent = `$${product.compareAtPrice}`;
    originalPrice.style.cssText = `
      font-size: 14px;
      color: #9ca3af;
      text-decoration: line-through;
    `;
    priceContainer.appendChild(originalPrice);

    // Savings text
    if (product.discountPercent) {
      const savings = document.createElement('span');
      savings.textContent = `Save ${product.discountPercent}%`;
      savings.style.cssText = `
        font-size: 12px;
        color: #10b981;
        font-weight: 600;
      `;
      priceContainer.appendChild(savings);
    }
  }

  detailsDiv.appendChild(priceContainer);

  // Description
  if (product.description) {
    const description = document.createElement('p');
    description.style.cssText = `
      margin: 0 0 12px 0;
      font-size: 13px;
      color: #6b7280;
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    `;
    description.textContent = product.description;
    detailsDiv.appendChild(description);
  }

  // Stock status
  const stockStatus = document.createElement('div');
  stockStatus.style.cssText = `
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 500;
  `;

  if (product.isAvailable) {
    stockStatus.innerHTML = `
      <span style="color: #10b981;">✓</span>
      <span style="color: #10b981;">In Stock</span>
    `;
    if (product.isLowStock && product.inventory) {
      stockStatus.innerHTML += `<span style="color: #f59e0b; margin-left: 8px;">(${product.inventory} left)</span>`;
    }
  } else {
    stockStatus.innerHTML = `
      <span style="color: #ef4444;">✕</span>
      <span style="color: #ef4444;">Out of Stock</span>
    `;
  }
  detailsDiv.appendChild(stockStatus);

  return detailsDiv;
}

// Create action buttons for product
function createProductActionButtons(product) {
  const actionsDiv = document.createElement('div');
  actionsDiv.style.cssText = `
    padding: 12px 16px;
    border-top: 1px solid #e5e7eb;
    display: flex;
    gap: 8px;
  `;

  // View Details button
  const viewBtn = document.createElement('button');
  viewBtn.textContent = product.cta || 'View Product';
  viewBtn.style.cssText = `
    flex: 1;
    padding: 10px 16px;
    background: white;
    border: 1.5px solid ${widgetSettings.primaryColor || '#ee5cee'};
    color: ${widgetSettings.primaryColor || '#ee5cee'};
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  `;
  viewBtn.onmouseover = () => {
    viewBtn.style.background = '#f9fafb';
  };
  viewBtn.onmouseout = () => {
    viewBtn.style.background = 'white';
  };
  viewBtn.onclick = () => {
    if (product.url) {
      window.open(product.url, '_blank');
    } else {
      const shopUrl = '{{ shop.url }}';
      window.open(`${shopUrl}/products/${product.handle}`, '_blank');
    }
  };
  actionsDiv.appendChild(viewBtn);

  // Add to Cart button (only if available)
  if (product.isAvailable) {
    const cartBtn = document.createElement('button');
    cartBtn.textContent = '🛒 Add';
    cartBtn.style.cssText = `
      flex: 1;
      padding: 10px 16px;
      background: ${widgetSettings.primaryColor || '#ee5cee'};
      border: none;
      color: white;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    `;
    cartBtn.onmouseover = () => {
      cartBtn.style.opacity = '0.9';
      cartBtn.style.transform = 'scale(1.02)';
    };
    cartBtn.onmouseout = () => {
      cartBtn.style.opacity = '1';
      cartBtn.style.transform = 'scale(1)';
    };
    cartBtn.onclick = () => {
      addToShopifyCart(product.id || product.handle, 1);
    };
    actionsDiv.appendChild(cartBtn);
  }

  return actionsDiv;
}
```

---

## 📦 Component 4: Shopify Cart Integration

Add these functions for Shopify AJAX API cart integration:

```javascript
// Add product to Shopify cart
async function addToShopifyCart(productIdOrHandle, quantity = 1) {
  try {
    // Show loading
    showCartLoading(true);

    // Convert product handle to variant ID if needed
    let variantId = productIdOrHandle;

    // If it's a handle (string), we need to fetch the product first
    if (typeof productIdOrHandle === 'string' && !productIdOrHandle.includes('gid://')) {
      const shopUrl = '{{ shop.url }}';
      const productResponse = await fetch(`${shopUrl}/products/${productIdOrHandle}.js`);
      if (!productResponse.ok) throw new Error('Product not found');

      const productData = await productResponse.json();
      variantId = productData.variants[0].id;
    }

    // Add to cart via Shopify AJAX API
    const response = await fetch('/cart/add.js', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: variantId,
        quantity: quantity
      })
    });

    if (!response.ok) {
      throw new Error('Failed to add to cart');
    }

    const data = await response.json();

    // Show success
    showCartLoading(false);
    showCartSuccess(data.product_title);

    // Update cart count (if you have a cart icon)
    updateCartCount();

  } catch (error) {
    console.error('Add to cart error:', error);
    showCartLoading(false);
    showCartError(error.message);
  }
}

// Show cart loading state
function showCartLoading(isLoading) {
  const existingNotif = document.getElementById('cart-notification');
  if (existingNotif) existingNotif.remove();

  if (!isLoading) return;

  const notif = createCartNotification('Adding to cart...', 'loading');
  document.body.appendChild(notif);
}

// Show cart success message
function showCartSuccess(productTitle) {
  const notif = createCartNotification(`✓ ${productTitle} added to cart!`, 'success');
  document.body.appendChild(notif);

  setTimeout(() => notif.remove(), 3000);
}

// Show cart error message
function showCartError(message) {
  const notif = createCartNotification(`✕ Error: ${message}`, 'error');
  document.body.appendChild(notif);

  setTimeout(() => notif.remove(), 3000);
}

// Create cart notification element
function createCartNotification(message, type) {
  const notif = document.createElement('div');
  notif.id = 'cart-notification';

  let bgColor = '#10b981'; // success green
  if (type === 'error') bgColor = '#ef4444'; // error red
  if (type === 'loading') bgColor = '#3b82f6'; // loading blue

  notif.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: ${bgColor};
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    z-index: 999999;
    animation: slideIn 0.3s ease;
  `;

  notif.textContent = message;
  return notif;
}

// Update cart count (optional - if you have a cart icon)
async function updateCartCount() {
  try {
    const response = await fetch('/cart.js');
    const cart = await response.json();
    const count = cart.item_count;

    // Update your cart icon count (if exists)
    const cartCountEl = document.querySelector('.cart-count');
    if (cartCountEl) {
      cartCountEl.textContent = count;
    }
  } catch (error) {
    console.error('Failed to update cart count:', error);
  }
}

// Add slide-in animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;
document.head.appendChild(style);
```

---

## 📦 Component 5: Sentiment-Based UI

Add this function to apply subtle UI changes based on sentiment:

```javascript
// Apply sentiment-based styling
function applySentimentStyling(sentiment) {
  const chatWindow = document.getElementById('ai-chat-window');
  if (!chatWindow) return;

  // Remove previous sentiment classes
  chatWindow.classList.remove('sentiment-positive', 'sentiment-negative', 'sentiment-neutral');

  // Add current sentiment class
  if (sentiment) {
    chatWindow.classList.add(`sentiment-${sentiment}`);
  }
}

// Add sentiment CSS styles
const sentimentStyles = document.createElement('style');
sentimentStyles.textContent = `
  /* Positive sentiment - brighter, more energetic */
  .sentiment-positive .ai-chat-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .sentiment-positive .assistant-message {
    border-left: 3px solid #10b981;
  }

  /* Negative sentiment - warmer, more empathetic */
  .sentiment-negative .ai-chat-header {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  }

  .sentiment-negative .assistant-message {
    border-left: 3px solid #f59e0b;
    background: #fef3c7;
  }

  /* Neutral sentiment - default colors */
  .sentiment-neutral .ai-chat-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }
`;
document.head.appendChild(sentimentStyles);
```

---

## 🔧 Update Main Response Handler

**UPDATE** the `sendAIMessage()` success handler to use all new components:

```javascript
// Inside sendChatMessage().then() callback, REPLACE the existing code with:
.then(data => {
  showLoading(false);

  // Handle response message
  const responseMessage = data.response || data.message;

  if (responseMessage) {
    // Add AI message
    addMessageToChat('assistant', responseMessage);

    // Display product recommendations (enhanced cards)
    if (data.recommendations && data.recommendations.length > 0) {
      displayProductRecommendations(data.recommendations);
    }

    // Display quick replies
    if (data.quickReplies && data.quickReplies.length > 0) {
      displayQuickReplies(data.quickReplies);
    }

    // Display suggested actions
    if (data.suggestedActions && data.suggestedActions.length > 0) {
      displaySuggestedActions(data.suggestedActions);
    }

    // Apply sentiment styling
    if (data.sentiment) {
      applySentimentStyling(data.sentiment);
    }

    // Handle human escalation
    if (data.requiresHumanEscalation) {
      setTimeout(() => {
        showEscalationPrompt();
      }, 1000);
    }

    // Update conversation history
    conversationHistory.push(
      { role: 'user', content: message },
      { role: 'assistant', content: responseMessage }
    );

    // Keep only last 10 messages
    if (conversationHistory.length > 10) {
      conversationHistory = conversationHistory.slice(-10);
    }
  } else {
    addMessageToChat('assistant', 'Sorry, I encountered an error. Please try again.');
  }
})
```

---

## 📦 Human Escalation Component

Add this function for human escalation:

```javascript
// Show human escalation prompt
function showEscalationPrompt() {
  const messagesContainer = document.getElementById('ai-chat-messages');

  const container = document.createElement('div');
  container.className = 'ai-message system-message';
  container.style.cssText = `
    margin: 16px 0;
    padding: 20px;
    background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
    border-radius: 12px;
    color: white;
    box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
  `;

  const message = document.createElement('p');
  message.style.cssText = `
    margin: 0 0 16px 0;
    font-size: 14px;
    line-height: 1.6;
  `;
  message.textContent = 'I sense you might need additional help. Would you like to speak with our support team?';
  container.appendChild(message);

  const buttonsDiv = document.createElement('div');
  buttonsDiv.style.cssText = 'display: flex; gap: 8px;';

  // Yes button
  const yesBtn = document.createElement('button');
  yesBtn.textContent = 'Yes, connect me';
  yesBtn.style.cssText = `
    flex: 1;
    padding: 12px;
    background: white;
    color: #f59e0b;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
  `;
  yesBtn.onclick = () => {
    // Redirect to support page or open email
    window.location.href = '/pages/contact'; // Update with your support page URL
  };

  // No button
  const noBtn = document.createElement('button');
  noBtn.textContent = 'No, continue with AI';
  noBtn.style.cssText = `
    flex: 1;
    padding: 12px;
    background: rgba(255,255,255,0.2);
    color: white;
    border: 1px solid white;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
  `;
  noBtn.onclick = () => {
    container.remove();
    addMessageToChat('assistant', "I'll continue helping you. What else can I assist with?");
  };

  buttonsDiv.appendChild(yesBtn);
  buttonsDiv.appendChild(noBtn);
  container.appendChild(buttonsDiv);

  messagesContainer.appendChild(container);
  scrollToBottom();
}
```

---

## 🎨 CSS Additions

Add these CSS classes to your stylesheet:

```css
/* Quick reply buttons */
.quick-reply-btn {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Enhanced product cards */
.enhanced-product-card:active {
  transform: scale(0.98);
}

/* Sentiment-based animations */
.sentiment-positive .message-content {
  animation: fadeInUp 0.4s ease;
}

.sentiment-negative .message-content {
  animation: fadeInSlow 0.6s ease;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeInSlow {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Mobile responsiveness */
@media (max-width: 640px) {
  .products-grid {
    grid-template-columns: 1fr !important;
  }

  #quick-replies-container {
    padding: 8px 12px;
  }

  .quick-reply-btn {
    font-size: 13px;
    padding: 6px 12px;
  }
}
```

---

## 🧪 Testing Checklist

After implementing all components, test:

- [x] Quick replies appear and send messages on click
- [x] Suggested actions render and trigger correct behaviors
- [x] Product cards show badges, discounts, urgency messages
- [x] "View Product" opens correct URL in new tab
- [x] "Add to Cart" adds product to Shopify cart
- [x] Cart notifications appear (success/error)
- [x] Sentiment styling applies correctly
- [x] Human escalation prompt shows when needed
- [x] Mobile responsive (all components work on small screens)
- [x] No console errors

---

## 📝 Integration Steps

1. **Backup current widget file**: Copy `ai_sales_assistant.liquid` to `ai_sales_assistant.liquid.backup`

2. **Add components one by one**:
   - Start with Quick Replies
   - Then Suggested Actions
   - Then Enhanced Product Cards
   - Then Cart Integration
   - Finally Sentiment Styling

3. **Test after each component**: Ensure nothing breaks

4. **Deploy to production**: Once all tests pass

---

## ✅ Expected Results

After full implementation, when a user sends "Show me red dresses under $100":

1. AI responds with message
2. **Quick replies appear**: "Show similar items", "What's on sale?", "Add to cart"
3. **Product cards display** with:
   - "20% OFF" badge (if discounted)
   - Relevance score badge "92% Match"
   - Strikethrough original price
   - "Only 3 left in stock!" urgency message
   - "View Product" and "Add to Cart" buttons
4. **Suggested actions bar** shows with contextual actions
5. **Sentiment styling** applies subtle UI changes
6. **Cart integration** works - clicking "Add to Cart" adds product

---

**Document Version**: 1.0
**Last Updated**: December 4, 2025
**Compatibility**: Shopibot Pro N8N Workflow + Phase 1 Backend
