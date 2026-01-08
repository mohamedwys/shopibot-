# Adding Usage Tracking to N8N BYOK Workflow

To track API usage (tokens, costs) for the BYOK plan, add a "Track Usage" node to your N8N workflow.

## Node Configuration

### 1. Add HTTP Request Node

After the **"Format Success Response"** node, add a new **HTTP Request** node named **"Track Usage"**.

### 2. Configure the Node

**Method:** POST

**URL:**
```
https://your-app.vercel.app/api/track-byok-usage
```

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "shop": "{{ $('Prepare Data').item.json.shop }}",
  "promptTokens": "{{ $('OpenAI Chat').item.json.usage.prompt_tokens }}",
  "completionTokens": "{{ $('OpenAI Chat').item.json.usage.completion_tokens }}",
  "totalTokens": "{{ $('OpenAI Chat').item.json.usage.total_tokens }}",
  "model": "{{ $('OpenAI Chat').item.json.model }}"
}
```

### 3. Connect the Nodes

The workflow should look like this:

```
OpenAI Chat
    ↓
Format Success Response
    ↓ ← ← ← ← ← ← ← ← ← ←
Track Usage     Respond to Webhook
    ↓                   ↑
(don't wait) ← ← ← ← ← ←
```

**Important:** The "Track Usage" node should run **in parallel** with "Respond to Webhook". You don't want to wait for tracking to complete before responding.

### 4. OpenAI Response Format

The OpenAI API response includes a `usage` object:

```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "gpt-4o-mini",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Your response here"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 50,
    "total_tokens": 75
  }
}
```

## Alternative: Simplified Workflow

If you don't want to track usage in N8N, you can skip this node. Usage tracking is optional but recommended for monitoring costs.

## Expected Response

The tracking endpoint returns:

```json
{
  "success": true,
  "message": "Usage tracked successfully",
  "usage": {
    "totalApiCalls": 142,
    "totalTokensUsed": 15234,
    "estimatedCost": 0.0456
  }
}
```

## Viewing Usage Data

Users can view their usage statistics in:
- **Shopify Admin** → **Settings** → **Usage Tracking** section (only visible for BYOK plan)

The dashboard shows:
- **Today's Usage**: API calls, tokens, estimated cost
- **This Month's Usage**: Aggregated monthly totals

## Cost Estimation

Costs are estimated based on OpenAI's pricing (as of 2024):

| Model | Prompt Tokens (per 1M) | Completion Tokens (per 1M) |
|-------|------------------------|----------------------------|
| gpt-4o-mini | $0.15 | $0.60 |
| gpt-4o | $2.50 | $10.00 |
| gpt-4 | $30.00 | $60.00 |
| gpt-3.5-turbo | $0.50 | $1.50 |

**Note:** These are estimates. Actual costs may vary. Check OpenAI's pricing page for current rates.
