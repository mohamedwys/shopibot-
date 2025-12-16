# 🔧 Chatbot Widget Troubleshooting Guide

## Issue: Chatbot Not Appearing on Store

### ✅ **Step 1: Enable App Embed in Theme Editor**

**This is the most common issue!** The app block needs to be manually activated.

1. **Shopify Admin** → **Online Store** → **Themes**
2. Click **"Customize"** on your active theme
3. In the left sidebar, scroll down and click **"App embeds"** (bottom section)
4. Look for **"AI Sales Assistant"**
5. **Toggle the switch ON** ✅
6. Click **"Save"** (top right)
7. **Refresh your store** to see the chatbot

### ✅ **Step 2: Verify App Settings**

1. Go to **Apps** → **Your Chatbot App** → **Settings**
2. Ensure these are configured:
   - ✅ **"Enable Widget"** is CHECKED
   - ✅ **Widget Position** is set (e.g., "Bottom Right")
   - ✅ **Button Text** has a value (default: "Ask AI Assistant")
   - ✅ **Primary Color** is set (default: #ee5cee)
3. Click **"Save Settings"**

### ✅ **Step 3: Check Workflow Configuration**

1. Go to **Settings** → **AI Workflow Configuration**
2. Select **"Use Developer's Default Workflow"** (recommended for testing)
3. Clear any custom webhook URL field
4. Click **"Save Settings"**

### ✅ **Step 4: Verify Extension Deployment**

**If running locally:**
```bash
shopify app dev
```

**If deployed to Vercel:**
1. Check Vercel deployment logs for errors
2. Ensure environment variables are set:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `SHOPIFY_API_KEY`

### ✅ **Step 5: Test API Endpoints**

Open browser console and test if the API is accessible:

```javascript
// Test widget settings API
fetch('https://YOUR-APP-URL/api/widget-settings?shop=YOUR-SHOP.myshopify.com')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);

// Test chat API
fetch('https://YOUR-APP-URL/apps/sales-assistant-api', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Shopify-Shop-Domain': 'YOUR-SHOP.myshopify.com'
  },
  body: JSON.stringify({
    userMessage: 'test',
    context: { shopDomain: 'YOUR-SHOP.myshopify.com' }
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

### ✅ **Step 6: Check Browser Console for Errors**

1. Open your store in a browser
2. Press **F12** to open Developer Tools
3. Go to **Console** tab
4. Look for errors related to:
   - `ai-sales-assistant.js` loading
   - `Failed to fetch` messages
   - CORS errors
   - Network errors

### ✅ **Step 7: Verify Database Migration**

If you just deployed, ensure the database migration ran:

```bash
npx prisma migrate deploy
```

This adds the `workflowUsage` field to the ChatAnalytics table.

### ✅ **Step 8: Clear Cache**

1. **Hard refresh** your store page: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. **Clear browser cache** completely
3. Try in **Incognito/Private** browsing mode

---

## 🐛 Common Errors & Solutions

### Error: "Failed to fetch settings"
**Solution:**
- Check that your app is deployed and accessible
- Verify the API endpoint: `/api/widget-settings` returns JSON
- Check CORS headers are properly set

### Error: "Chatbot appears but doesn't respond"
**Solution:**
- Check **Settings** → ensure "Default Workflow" is selected
- Check **Analytics** to see if messages are being tracked
- Look at server logs for errors in `/apps/sales-assistant-api`

### Error: Widget visible in Theme Editor but not on live store
**Solution:**
- Make sure App Embed is **published** (not just saved in editor)
- Check if widget is enabled in **App Settings**
- Verify extension is deployed (not just in local dev)

### Error: "Widget shows but is styled incorrectly"
**Solution:**
- Check that `ai-sales-assistant.css` is loading
- Verify Primary Color is set in Settings
- Clear browser cache and hard refresh

---

## 📋 **Quick Checklist**

Before asking for help, verify:

- [ ] App Embed is **enabled** in Theme Editor
- [ ] Widget is **enabled** in App Settings
- [ ] App is **deployed** (not just running locally)
- [ ] Database migration has run successfully
- [ ] API endpoints are accessible
- [ ] Browser console shows no critical errors
- [ ] Default workflow is selected in Settings
- [ ] Hard refresh has been performed

---

## 🆘 **Still Not Working?**

### Debug Mode:
Add this to your browser console to see detailed logs:

```javascript
localStorage.setItem('aiChatDebug', 'true');
location.reload();
```

### Check Network Requests:
1. Open Developer Tools → **Network** tab
2. Filter by **Fetch/XHR**
3. Refresh page and look for:
   - Request to `widget-settings` API
   - Response status (should be 200)
   - Response body (should contain settings JSON)

### Manual Test:
Add this HTML to any page to test if the widget JavaScript works:

```html
<div id="ai-sales-assistant-container"></div>
<script>
  window.aiSalesAssistantSettings = {
    enabled: true,
    position: 'bottom-right',
    buttonText: 'Test Chat',
    chatTitle: 'Test',
    primaryColor: '#ee5cee',
    shopDomain: 'YOUR-SHOP.myshopify.com',
    currency: 'USD'
  };
</script>
<script src="https://YOUR-APP-URL/assets/ai-sales-assistant.js"></script>
<link rel="stylesheet" href="https://YOUR-APP-URL/assets/ai-sales-assistant.css">
```

---

## 📞 **Contact Support**

If you've tried all steps above, provide this information:
1. Shopify store URL
2. App deployment URL (Vercel/other)
3. Browser console errors (screenshot)
4. Network tab showing failed requests
5. App Settings screenshot
6. Theme Editor App Embeds screenshot
