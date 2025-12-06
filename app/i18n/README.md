# Internationalization (i18n) Structure

This directory contains the centralized i18n configuration for the Shopify app.

## Architecture

### Files:

- **`index.ts`** - Core i18n configuration (languages, fallback, namespaces)
- **`resources.ts`** - Bundled translation resources for server-side rendering
- **`i18next.server.ts`** - RemixI18Next server instance configuration

### Translation Files Location:

- **`app/locales/`** - Translation JSON files bundled for server-side imports
- **`public/locales/`** - Translation JSON files served for client-side HTTP loading

## How It Works

### Server-Side Rendering (SSR):
1. `entry.server.tsx` imports bundled resources from `app/i18n/resources.ts`
2. i18next instance is created per request with the appropriate locale
3. Translations are available immediately (no file I/O)
4. Works in serverless environments (Vercel, AWS Lambda, etc.)

### Client-Side Hydration:
1. `entry.client.tsx` uses i18next-http-backend
2. Loads translations from `/locales/{lng}/{ns}.json` (public folder)
3. Enables dynamic language switching without page reload
4. Browser caches translation files

## Supported Languages

- English (en) - Default
- Spanish (es)
- French (fr)
- German (de)
- Japanese (ja)
- Italian (it)
- Portuguese (pt)
- Chinese (zh)

## Adding New Languages

1. Add translation files:
   - `app/locales/{code}/common.json`
   - `public/locales/{code}/common.json`

2. Update `app/i18n/index.ts`:
   ```typescript
   supportedLngs: ["en", "es", "fr", "de", "ja", "it", "pt", "zh", "NEW_CODE"]
   ```

3. Update `app/i18n/resources.ts`:
   ```typescript
   import newLang from "../locales/NEW_CODE/common.json";

   export const resources = {
     // ... existing languages
     NEW_CODE: { common: newLang },
   };
   ```

4. Update language selector in `app/routes/app.tsx`

## Adding New Namespaces

Currently using: `common`

To add more namespaces (e.g., `dashboard`, `settings`):

1. Create new translation files:
   - `app/locales/{lng}/dashboard.json`
   - `public/locales/{lng}/dashboard.json`

2. Update `resources.ts` to include new namespace

3. Update route's `handle` export:
   ```typescript
   export const handle = {
     i18n: ["common", "dashboard"], // multiple namespaces
   };
   ```

## Key Features

- ✅ Serverless-compatible (no filesystem dependencies)
- ✅ Cookie-based locale persistence
- ✅ SSR with hydration
- ✅ Dynamic language switching
- ✅ TypeScript type safety
- ✅ Production-ready
