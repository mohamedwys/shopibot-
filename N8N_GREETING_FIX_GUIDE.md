# N8N Greeting Repetition Fix - Complete Guide

## Problem Fixed
The N8N agent was saying "Bonjour" or "Hello" at the beginning of **every** response, even after multiple exchanges in the same conversation.

## Root Cause
The N8N workflow was not receiving conversation history, so it thought each message was the first message in the conversation and greeted the user every time.

## Solution Implemented

### 1. Backend Changes (✅ COMPLETED)

#### Files Modified:
- `app/routes/apps.sales-assistant-api.tsx` - Added conversation history to N8N payload
- `app/services/n8n.service.server.ts` - Updated TypeScript interfaces

#### New Fields Sent to N8N:

```typescript
{
  userMessage: "Do you have blue shirts?",
  products: [...],
  context: {
    // ... other fields ...

    // ✅ NEW: Conversation tracking fields
    previousMessages: [
      "Hi",
      "Hello! How can I help you today?",
      "I'm looking for t-shirts"
    ],
    conversationHistory: [
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello! How can I help you today?" },
      { role: "user", content: "I'm looking for t-shirts" }
    ],
    messageCount: 4,        // Current message is #4
    isFirstMessage: false   // This is NOT the first message
  }
}
```

### 2. N8N Workflow Changes (⚠️ REQUIRED - Manual Setup)

You need to update your N8N workflow's system prompt to use these new fields.

#### Where to Make Changes:
1. Open your N8N workflow
2. Find the **AI Agent** or **OpenAI** node that generates responses
3. Locate the **System Prompt** / **System Message** field
4. Add the following section at the **beginning** of the prompt

#### Prompt to Add:

```
**CONVERSATION CONTEXT:**
- Message number: {{ $json.context.messageCount || 1 }}
- Is first message: {{ $json.context.isFirstMessage ? 'YES' : 'NO' }}
- Previous messages count: {{ ($json.context.conversationHistory || []).length }}

**CRITICAL GREETING RULE:**
- If message #1 (isFirstMessage = YES): Start with a friendly greeting
- If message #2+ (isFirstMessage = NO): NO greeting, continue the conversation naturally
- NEVER repeat "Hello", "Bonjour", "Hi", or any greeting after the first message
- Continue the conversation as if you remember the previous context

**Conversation History:**
{{ $json.context.conversationHistory ? $json.context.conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n') : 'No previous messages' }}

---
```

#### Example N8N Configuration:

**Before:**
```
You are a helpful AI shopping assistant for {{ $json.context.shopDomain }}.
Help users find products and answer their questions.
```

**After:**
```
**CONVERSATION CONTEXT:**
- Message number: {{ $json.context.messageCount || 1 }}
- Is first message: {{ $json.context.isFirstMessage ? 'YES' : 'NO' }}
- Previous messages count: {{ ($json.context.conversationHistory || []).length }}

**CRITICAL GREETING RULE:**
- If message #1 (isFirstMessage = YES): Start with a friendly greeting
- If message #2+ (isFirstMessage = NO): NO greeting, continue the conversation naturally
- NEVER repeat "Hello", "Bonjour", "Hi", or any greeting after the first message
- Continue the conversation as if you remember the previous context

**Conversation History:**
{{ $json.context.conversationHistory ? $json.context.conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n') : 'No previous messages' }}

---

You are a helpful AI shopping assistant for {{ $json.context.shopDomain }}.
Help users find products and answer their questions.
```

### 3. Alternative: Use Conversation History Directly

If your N8N workflow uses OpenAI's Chat Completion API, you can pass the conversation history directly to the `messages` array:

```javascript
// In your N8N OpenAI node configuration
{
  "model": "gpt-4",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful shopping assistant..."
    },
    // ✅ Add conversation history from context
    ...($json.context.conversationHistory || []).map(msg => ({
      "role": msg.role,
      "content": msg.content
    })),
    // Add current message
    {
      "role": "user",
      "content": $json.userMessage
    }
  ]
}
```

## Testing Your Fix

### Test Scenario 1: New Conversation
```
User: "Hi"
Expected: "Bonjour! How can I help you today?" ✅ (Greeting is appropriate)

User: "Do you have blue shirts?"
Expected: "Yes, we have blue t-shirts available..." ✅ (No greeting)

User: "What's the price?"
Expected: "The blue t-shirt is 75.99 AED" ✅ (No greeting)
```

### Test Scenario 2: Existing Conversation
```
User: "Show me more products"
Expected: "Here are some additional products..." ✅ (No greeting)
```

## Debugging

### Check if History is Being Sent:

1. In your N8N workflow, add a **Set** node before the AI node
2. Add this expression to inspect the data:
```javascript
{
  "messageCount": {{ $json.context.messageCount }},
  "isFirstMessage": {{ $json.context.isFirstMessage }},
  "historyLength": {{ ($json.context.conversationHistory || []).length }},
  "previousMessages": {{ JSON.stringify($json.context.previousMessages) }}
}
```

3. Execute the workflow and check the Set node output

### Expected Output for Message #3:
```json
{
  "messageCount": 3,
  "isFirstMessage": false,
  "historyLength": 2,
  "previousMessages": [
    "Hi",
    "Hello! How can I help you today?"
  ]
}
```

## N8N Workflow Templates

### Template 1: Simple Conditional Greeting

```javascript
// In your AI response generation code
const isFirstMessage = $json.context.isFirstMessage;
const greeting = isFirstMessage ? "Hello! " : "";
const response = greeting + generateResponse($json.userMessage);
```

### Template 2: Using OpenAI Function Calling

```json
{
  "model": "gpt-4o",
  "messages": [
    {
      "role": "system",
      "content": "You are a shopping assistant. Current context: Message #{{ $json.context.messageCount }}, First message: {{ $json.context.isFirstMessage }}"
    }
  ],
  "tools": [...]
}
```

## Common Issues

### Issue 1: Still Getting Greetings on Every Message
**Cause:** N8N prompt not updated
**Solution:** Add the GREETING RULE to your system prompt (see section 2 above)

### Issue 2: conversationHistory is empty
**Cause:** Using old API endpoint or session expired
**Solution:** Ensure you're using the latest code and session is within 24 hours

### Issue 3: messageCount is always 1
**Cause:** New session created for each message
**Solution:** Ensure `sessionId` is being passed consistently in the request

## API Endpoints

This fix applies to:
- ✅ `/apps/sales-assistant-api` (Theme extension API)
- ✅ `/api/widget-settings` (Widget API)

Both endpoints now send conversation history to N8N.

## Summary

✅ **Backend Changes:** Complete - conversation history is now sent to N8N
⚠️ **N8N Workflow:** Manual update required - add greeting rules to system prompt
🧪 **Testing:** Follow test scenarios above to verify fix

## Need Help?

If you encounter issues:
1. Check N8N workflow execution logs
2. Verify `conversationHistory` is populated in the webhook payload
3. Ensure your system prompt includes the greeting rules
4. Test with a fresh browser session (clear cookies if needed)
