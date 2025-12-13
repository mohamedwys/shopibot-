# 🔍 Debug Commands for OpenAI Not Working

## Step 1: Check Local Environment

```bash
# Check if .env file exists and has OPENAI_API_KEY
cat .env | grep OPENAI_API_KEY

# If not found, check other env files
ls -la | grep env
cat .env.local 2>/dev/null | grep OPENAI_API_KEY || echo ".env.local not found"
```

## Step 2: Run Diagnostic Script

```bash
# This will test your entire OpenAI + N8N configuration
npx tsx scripts/check-openai-config.ts
```

## Step 3: Check Vercel Environment Variables

```bash
# List all Vercel environment variables
vercel env ls

# Check if OPENAI_API_KEY is set in Vercel
vercel env pull .env.vercel
cat .env.vercel | grep OPENAI_API_KEY
```

## Step 4: Test in Development

```bash
# Load environment and start dev server
npm run dev

# In another terminal, check if the key is loaded
curl -X POST http://localhost:3000/api/test-openai-config \
  -H "Content-Type: application/json"
```

## Common Issues & Fixes

### Issue 1: OPENAI_API_KEY not in .env
**Fix:**
```bash
echo "OPENAI_API_KEY=sk-your-actual-key-here" >> .env
```

### Issue 2: OPENAI_API_KEY in .env but not loading
**Fix:**
```bash
# Make sure .env is in the root directory
pwd
ls -la .env

# Restart your dev server
npm run dev
```

### Issue 3: Works locally but not on Vercel
**Fix:**
```bash
# Add to Vercel environment variables
vercel env add OPENAI_API_KEY production
# Paste your OpenAI key when prompted

# Redeploy
vercel --prod
```

### Issue 4: OpenAI key is invalid or has no quota
**Check:**
- Go to https://platform.openai.com/api-keys
- Verify your key is active
- Check usage at https://platform.openai.com/usage
- Add credits if needed

## Expected Output When Working

When OpenAI is properly configured, you should see:
```
✅ OPENAI_API_KEY: Set (sk-proj-...xxxx)
✅ Embedding Service: Available (OpenAI key valid)
✅ Personalization Service: OpenAI initialized
✅ OpenAI connection is WORKING!
```

## Still Not Working?

Check the server logs:
```bash
# Check Vercel logs
vercel logs

# Check local logs when a chat message is sent
# You should see logs like:
# "Using semantic search with embeddings"
# "Intent classified by AI"
# "Sentiment analyzed"
```

