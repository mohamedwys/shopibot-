# Testing Sentry Error Monitoring

This guide explains how to test that Sentry is properly configured and capturing errors.

## Prerequisites

1. Get a Sentry DSN from [sentry.io](https://sentry.io)
2. Add `SENTRY_DSN` to your `.env` file:
   ```env
   SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
   ```
3. Restart your development server

## Testing Server-Side Error Tracking

### Method 1: Trigger an Unhandled Error

Add a test route that throws an error:

```typescript
// app/routes/test-error.tsx
export async function loader() {
  throw new Error("Test server-side error");
}

export default function TestError() {
  return <div>This should never render</div>;
}
```

Navigate to `/test-error` and check your Sentry dashboard for the error.

### Method 2: Manually Capture an Exception

```typescript
import { captureException } from "~/lib/sentry.server";

// In any server-side code (loader, action, etc.)
try {
  // Some code that might fail
  throw new Error("Something went wrong");
} catch (error) {
  captureException(error instanceof Error ? error : new Error(String(error)), {
    context: "custom-context",
    userId: "user-123",
  });
}
```

### Method 3: Send a Test Message

```typescript
import { captureMessage } from "~/lib/sentry.server";

// In any server-side code
export async function action({ request }: ActionFunctionArgs) {
  captureMessage("Test message from server", "info", {
    testType: "manual-test",
  });

  return json({ success: true });
}
```

## Testing Client-Side Error Tracking

### Method 1: Trigger a Render Error

Create a component that throws an error:

```typescript
// app/components/TestError.tsx
export function TestError() {
  throw new Error("Test client-side error");
  return <div>This won't render</div>;
}
```

Then use it in any route:

```typescript
import { TestError } from "~/components/TestError";

export default function SomePage() {
  const [showError, setShowError] = useState(false);

  return (
    <div>
      <button onClick={() => setShowError(true)}>
        Trigger Error
      </button>
      {showError && <TestError />}
    </div>
  );
}
```

You should see the error boundary fallback UI and the error in Sentry.

### Method 2: Trigger an Event Handler Error

```typescript
export default function SomePage() {
  const handleClick = () => {
    throw new Error("Test click handler error");
  };

  return (
    <button onClick={handleClick}>
      Trigger Error
    </button>
  );
}
```

### Method 3: Browser Console Test

Open your browser's developer console and run:

```javascript
throw new Error("Test console error");
```

The error should be captured by Sentry.

## What to Check in Sentry Dashboard

After triggering errors, verify the following in your Sentry dashboard:

1. **Error appears** - Check Issues tab for new errors
2. **Error details** - Stack trace should be visible
3. **Environment** - Should show "development" or "production"
4. **PII redaction** - Sensitive data (emails, tokens) should be `[REDACTED]`
5. **Context** - Custom context data should appear in "Additional Data"
6. **User info** - Shop domain should appear (email should NOT)
7. **Breadcrumbs** - Navigation and user actions should be tracked

## Expected Behavior

### Server-Side Errors
- Captured by `entry.server.tsx` error handlers
- Includes request URL and context
- Shows full stack trace
- Sensitive headers are redacted

### Client-Side Errors
- Captured by React Error Boundary
- Shows error fallback UI to user
- Session replay (if configured)
- User sees friendly error message

## Troubleshooting

### No Errors Appearing in Sentry

1. **Check DSN configuration**
   ```bash
   # In your terminal
   echo $SENTRY_DSN
   ```
   Should print your Sentry DSN.

2. **Check browser console**
   - Look for "✅ Sentry initialized" message
   - Look for any Sentry-related errors

3. **Check server logs**
   - Look for "✅ Sentry initialized for server-side error tracking"
   - Look for "⚠️ SENTRY_DSN not configured" warning

4. **Verify NODE_ENV**
   - Sample rates are lower in production (10% vs 100%)
   - Try setting `NODE_ENV=development`

### Errors Not Showing Stack Traces

Make sure source maps are enabled in your build:

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    sourcemap: true,
  },
});
```

### Sensitive Data Not Redacted

Check the `beforeSend` hooks in:
- `app/lib/sentry.client.ts` - Client-side redaction
- `app/lib/sentry.server.ts` - Server-side redaction

## Production Deployment

Before deploying to production:

1. **Set SENTRY_DSN** in your hosting platform's environment variables
2. **Enable source maps upload** (optional but recommended):
   ```bash
   npm install @sentry/webpack-plugin --save-dev
   ```

3. **Adjust sample rates** in `sentry.server.ts` and `sentry.client.ts`:
   ```typescript
   tracesSampleRate: 0.1, // 10% in production
   replaysSessionSampleRate: 0.1, // 10% in production
   ```

4. **Set up alerts** in Sentry dashboard for critical errors

5. **Configure release tracking** (optional):
   ```typescript
   Sentry.init({
     // ...
     release: process.env.VERCEL_GIT_COMMIT_SHA || 'dev',
   });
   ```

## Additional Resources

- [Sentry Remix Documentation](https://docs.sentry.io/platforms/javascript/guides/remix/)
- [Sentry Best Practices](https://docs.sentry.io/platforms/javascript/best-practices/)
- [Error Boundary Documentation](https://docs.sentry.io/platforms/javascript/guides/react/features/error-boundary/)
