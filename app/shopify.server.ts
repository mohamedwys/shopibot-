// app/shopify.server.ts
import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
// ✅ CRITICAL FIX: Use PrismaSessionStorage for persistent sessions
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { prisma } from "./db.server";
import { BILLING_PLANS } from "./config/billing";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  // ✅ CRITICAL FIX: Use PrismaSessionStorage for persistent sessions across restarts
  // This fixes the "Could not find a session" error that required app reinstallation
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    unstable_newEmbeddedAuthStrategy: true, // ✅ enables token-based auth
    removeRest: true,
  },
  billing: {
    [BILLING_PLANS.STARTER.name]: {
      amount: BILLING_PLANS.STARTER.amount,
      currencyCode: BILLING_PLANS.STARTER.currencyCode,
      interval: BILLING_PLANS.STARTER.interval,
      trialDays: BILLING_PLANS.STARTER.trialDays,
    },
    [BILLING_PLANS.PROFESSIONAL.name]: {
      amount: BILLING_PLANS.PROFESSIONAL.amount,
      currencyCode: BILLING_PLANS.PROFESSIONAL.currencyCode,
      interval: BILLING_PLANS.PROFESSIONAL.interval,
      trialDays: BILLING_PLANS.PROFESSIONAL.trialDays,
    },
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.January25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;