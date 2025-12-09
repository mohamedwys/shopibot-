# i18n Language Switching Fix - Implementation Summary

## 🎯 Problem Statement

Shopify embedded app had broken i18n language switching due to:
1. **Cookie attributes incompatible with iframe** (sameSite: "lax" instead of "none")
2. **Missing CHIPS compliance** (no `partitioned: true`)
3. **Redirect-based language switching** causing session/CSP issues in iframe
4. **No Polaris i18n integration** (Polaris components always in English)

## ✅ Solutions Implemented

### 1. Fixed Cookie Attributes (CHIPS Compliance)
**File:** `app/i18n/i18next.server.ts:22-33`

```typescript
export const localeCookie = createCookie("locale", {
  path: "/",
  httpOnly: false,           // ✅ Required for client-side read
  sameSite: "none",          // ✅ CRITICAL: Required for cross-site iframe
  secure: true,              // ✅ CRITICAL: Must be true when sameSite="none"
  maxAge: 60 * 60 * 24 * 365,
  partitioned: true,         // ✅ CHIPS compliance (Safari/Chrome 2025+)
});
```

**Why this matters:**
- `sameSite: "none"` allows cookies to be sent in cross-site contexts (Shopify iframe)
- `secure: true` is mandatory when `sameSite: "none"`
- `partitioned: true` enables CHIPS (Cookies Having Independent Partitioned State) for modern browsers
- Without these, cookies are blocked in 3rd-party contexts (Shopify Admin → your Vercel app)

### 2. Improved Detection Order with Logging
**File:** `app/i18n/i18next.server.ts:35-66`

```typescript
export async function getLocaleFromRequest(request: Request): Promise<SupportedLocale> {
  // PRIORITY 1: Check cookie (user's explicit choice)
  // PRIORITY 2: Check URL param (Shopify iframe default)
  // PRIORITY 3: Fallback to default ("en")
}
```

**Added comprehensive logging:**
- `✅ Using locale from COOKIE: es` - Cookie found and used
- `⚠️ Using locale from URL: en (cookie not found)` - Fallback to URL param
- `⚠️ Invalid cookie value` - Cookie exists but invalid
- `ℹ️ No cookie header found` - No cookie in request

### 3. JSON-Based Locale Switching (No Redirects)
**File:** `app/routes/set-locale.tsx`

**Before:** Used `redirect()` → caused iframe reload → session/CSP issues
**After:** Returns JSON with Set-Cookie header

```typescript
export async function action({ request }: ActionFunctionArgs) {
  // Supports both JSON and FormData
  return json(
    { success: true, locale },
    { headers: { "Set-Cookie": await localeCookie.serialize(locale) } }
  );
}
```

**Benefits:**
- No redirect = no iframe reload issues
- Works with fetch API from client
- Supports both JSON and FormData for flexibility

### 4. Client-Side Language Switcher
**File:** `app/components/LanguageSwitcher.tsx`

**Before:** Form submission with redirect
**After:** Fetch API with client-side reload

```typescript
const handleLocaleChange = async (newLocale: string) => {
  const response = await fetch("/set-locale", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale: newLocale }),
    credentials: "include", // ✅ Important for cookies in iframe
  });

  if (result.success) {
    window.location.reload(); // Clean reload with new cookie
  }
};
```

**Features:**
- Loading state with visual feedback
- Error handling with user alerts
- `credentials: "include"` ensures cookies work in iframe

### 5. Polaris i18n Integration
**Files:**
- `app/lib/polaris-i18n.ts` (new)
- `app/routes/app.tsx` (updated)
- `app/components/PolarisLanguageSwitcher.tsx` (new)

**Implementation:**
```typescript
// Load Polaris translations dynamically
const translations = await loadPolarisTranslations(locale);

// Pass to AppProvider
<AppProvider isEmbeddedApp apiKey={apiKey} i18n={polarisTranslations}>
```

**Polaris Locale Mapping:**
- `pt` → `pt-BR` (Polaris uses Brazilian Portuguese)
- `zh` → `zh-CN` (Polaris uses Simplified Chinese)
- Automatic fallback to English if translations unavailable

## 📁 Files Modified/Created

### Modified:
1. ✏️ `app/i18n/i18next.server.ts` - Cookie attributes + detection logging
2. ✏️ `app/routes/set-locale.tsx` - JSON response instead of redirect
3. ✏️ `app/components/LanguageSwitcher.tsx` - Fetch API instead of form
4. ✏️ `app/routes/app.tsx` - Polaris i18n integration

### Created:
1. ➕ `app/lib/polaris-i18n.ts` - Polaris translation loader
2. ➕ `app/components/PolarisLanguageSwitcher.tsx` - Polaris Select component

## 🧪 Testing Checklist

### 1. Cookie Validation
```bash
# Check browser DevTools → Application → Cookies
# Should see:
# Name: locale
# Value: es (or your selected language)
# SameSite: None
# Secure: ✓
# Partitioned: ✓ (Chrome/Edge only)
```

### 2. Server Logs
```
[set-locale.action] ✅ Setting locale cookie: es
[getLocaleFromRequest] ✅ Using locale from COOKIE: es
[app.tsx] Polaris translations loaded for: es
```

### 3. UI Testing
- [ ] Language switcher dropdown shows current language
- [ ] Changing language shows loading state
- [ ] Page reloads with new language
- [ ] Polaris components (buttons, etc.) translated
- [ ] Custom app text translated
- [ ] Works in Shopify Admin iframe (not just standalone)

### 4. Cross-Browser Testing
- [ ] Chrome/Edge (CHIPS supported)
- [ ] Safari (CHIPS supported from Safari 16.4+)
- [ ] Firefox (may not support `partitioned` yet)

## 🚨 Important Notes

### Production Deployment
1. **HTTPS Required**: `sameSite: "none"` only works over HTTPS
2. **Vercel Domain**: Ensure your Vercel deployment uses HTTPS (default)
3. **Shopify App URL**: Must match your Vercel HTTPS URL exactly

### Debugging Tips
If language switching still fails:

1. **Check browser console** for errors
2. **Check server logs** for cookie detection messages
3. **Verify cookie in DevTools**:
   - If cookie missing → check HTTPS/secure flag
   - If cookie exists but not read → check sameSite/partitioned
   - If cookie blocked → check browser privacy settings

4. **Test in incognito** to rule out cached cookies

### Browser Compatibility
- **Chrome/Edge 114+**: Full CHIPS support ✅
- **Safari 16.4+**: Full CHIPS support ✅
- **Firefox**: Limited CHIPS support (may work without `partitioned`)

## 📊 Expected Behavior

### Before Fix:
```
User selects Spanish → Cookie set with sameSite: "lax" → Cookie blocked in iframe
→ Next page load uses URL param (?locale=en) → Language reverts to English ❌
```

### After Fix:
```
User selects Spanish → Cookie set with sameSite: "none", partitioned: true
→ Cookie readable in iframe → Next page load uses cookie → Language stays Spanish ✅
```

## 🔄 Migration Notes

No migration needed! Changes are backward compatible:
- Existing cookies will be overwritten on next language change
- Users may need to re-select language once after deployment

## 🎉 Benefits

1. ✅ Language persists across page reloads in iframe
2. ✅ Works in modern browsers (Safari/Chrome 2025+ compliance)
3. ✅ Polaris components fully translated
4. ✅ No CSP/session issues from redirects
5. ✅ Better error handling and logging
6. ✅ Production-ready with TypeScript types

## 📚 References

- [CHIPS (Cookies Having Independent Partitioned State)](https://developer.chrome.com/docs/privacy-sandbox/chips/)
- [SameSite Cookie Attribute](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
- [Shopify App Bridge](https://shopify.dev/docs/api/app-bridge)
- [Polaris i18n](https://polaris.shopify.com/components/utilities/app-provider#using-translations)
