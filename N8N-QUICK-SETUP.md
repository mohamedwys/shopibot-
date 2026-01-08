# N8N BYOK Quick Setup (No Environment Variables)

Since your N8N instance doesn't have environment variable settings, use this simplified version.

## Step 1: Get Your Configuration Values

### 1. Your App URL
This is your Vercel deployment URL. Example:
```
https://shopibot-abc123.vercel.app
```

**How to find it:**
- Go to your Vercel dashboard
- Click on your project
- Copy the "Deployment URL" (without trailing slash)

### 2. Your Internal API Key
This is in your Vercel environment variables.

**How to find it:**
- Go to Vercel → Your Project → **Settings** → **Environment Variables**
- Look for `INTERNAL_API_KEY`
- Copy the entire 64-character value

**Don't have one yet?** Generate it:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Then add it to Vercel as `INTERNAL_API_KEY` (production, preview, development).

## Step 2: Import Workflow in N8N

1. **Download the file:**
   - File: `n8n-byok-workflow-no-env.json`

2. **In N8N:**
   - Go to **Workflows**
   - Click **"Import from File"** or create new → "Import"
   - Upload `n8n-byok-workflow-no-env.json`

3. **The workflow will be imported** with these placeholder values:
   - `YOUR-APP-URL.vercel.app` → You'll replace this
   - `YOUR-64-CHAR-INTERNAL-API-KEY-HERE` → You'll replace this

## Step 3: Configure the 2 HTTP Request Nodes

You need to update **2 nodes only**:

### Node 1: "Get Shop Settings"

1. Click on the **"Get Shop Settings"** node
2. Find the **URL** field, it says:
   ```
   https://YOUR-APP-URL.vercel.app/api/settings/{{ $json.body.context.shopDomain }}
   ```
3. **Replace ONLY the first part:**
   ```
   https://your-actual-app.vercel.app/api/settings/{{ $json.body.context.shopDomain }}
   ```
   ⚠️ **IMPORTANT:** Keep the `{{ $json.body.context.shopDomain }}` part exactly as-is!

4. Scroll down to **Headers** section
5. Find the `X-API-Key` header value:
   ```
   YOUR-64-CHAR-INTERNAL-API-KEY-HERE
   ```
6. **Replace with your actual INTERNAL_API_KEY** (64 characters)

7. Click **"Execute node"** or save

### Node 2: "Log Conversation"

1. Click on the **"Log Conversation"** node
2. Find the **URL** field:
   ```
   https://YOUR-APP-URL.vercel.app/api/log-conversation
   ```
3. **Replace with your actual URL:**
   ```
   https://your-actual-app.vercel.app/api/log-conversation
   ```

4. Scroll down to **Headers** section
5. Find the `X-API-Key` header value:
   ```
   YOUR-64-CHAR-INTERNAL-API-KEY-HERE
   ```
6. **Replace with your actual INTERNAL_API_KEY** (same one as before)

7. Click **"Execute node"** or save

## Step 4: Save and Activate Workflow

1. **Save** the workflow (top right)
2. **Activate** the workflow (toggle switch in top right)
3. **Copy the Webhook URL:**
   - Click on the **"Webhook"** node
   - Copy the "Test URL" or "Production URL"
   - It will look like: `https://your-n8n.app.n8n.cloud/webhook/byok-chatbot`

## Step 5: Update Vercel Environment Variable

```bash
# In your terminal or Vercel dashboard:
vercel env add N8N_WEBHOOK_BYOK production
# Paste the webhook URL you just copied
```

Or in **Vercel Dashboard:**
- Settings → Environment Variables → Add New
- Name: `N8N_WEBHOOK_BYOK`
- Value: `https://your-n8n.app.n8n.cloud/webhook/byok-chatbot`
- Environment: Production (and Preview if you want)

## Step 6: Redeploy and Test

1. **Redeploy your app** (Vercel will auto-redeploy when you add env var)
2. Go to your **Shopify Admin** → **Settings**
3. Select **"BYOK (Bring Your Own Key)"** plan
4. Enter your **OpenAI API key** (starts with `sk-` or `sk-proj-`)
5. **Save**
6. **Test** the chatbot with: "salut je recherche des chaussures noir"

## Troubleshooting

### Test the "Get Shop Settings" node manually

1. In N8N, click on **"Get Shop Settings"** node
2. Click **"Execute node"**
3. You might get an error because `$json.body.context.shopDomain` doesn't exist in test mode
4. That's OK! The important thing is:
   - If you get a 401/403 error → Your API key is wrong
   - If you get a connection error → Your URL is wrong
   - If you get "shopDomain is undefined" → The node is configured correctly!

### Expected N8N Execution Flow

When a user sends a message:
1. **Webhook** receives the request
2. **Get Shop Settings** fetches the OpenAI API key (decrypted)
3. **Prepare Data** extracts all the data
4. **Check API Key Exists** validates the key is present
5. **OpenAI Chat** calls OpenAI with the customer's API key
6. **Format Success Response** creates the response in the correct format
7. **Log Conversation** saves to your database
8. **Respond to Webhook** sends the response back to your app

### Check Vercel Logs

After testing, check your Vercel logs. You should see:
```
✅ 🔑 Decrypted OpenAI API key for BYOK plan
✅ 🔄 WORKFLOW: BYOK Workflow...
✅ 📨 DEBUG: Final response being returned:
✅ - Message: [OpenAI's response in French]
```

No more errors about "missing message field"!

## Summary of Values to Replace

| Location | Field | Replace With |
|----------|-------|--------------|
| "Get Shop Settings" node | URL | `https://your-app.vercel.app/api/settings/{{ $json.body.context.shopDomain }}` |
| "Get Shop Settings" node | X-API-Key header | Your 64-char INTERNAL_API_KEY |
| "Log Conversation" node | URL | `https://your-app.vercel.app/api/log-conversation` |
| "Log Conversation" node | X-API-Key header | Your 64-char INTERNAL_API_KEY (same as above) |

**That's it!** Just 2 nodes, 4 values total to update.
