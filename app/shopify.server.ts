import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  BillingInterval,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { MemorySessionStorage } from "@shopify/shopify-app-session-storage-memory";
import { prisma } from "./db.server"; // ← named import
// Use PrismaSessionStorage if DATABASE_URL is configured for PostgreSQL, otherwise use Memory
const isPostgresConfigured = process.env.DATABASE_URL?.startsWith('postgresql://');
const configuredSessionStorage = isPostgresConfigured
  ? new PrismaSessionStorage(prisma)
  : new MemorySessionStorage();

console.log(`🔧 Session Storage: ${isPostgresConfigured ? 'Prisma (PostgreSQL)' : 'Memory'}`);

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: configuredSessionStorage,
  distribution: AppDistribution.AppStore,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    removeRest: true,
  },
  billing: {
    "Starter Plan": {
      amount: 25.0,
      currencyCode: "USD",
      interval: BillingInterval.Every30Days as any,
      trialDays: 7,
    },
    "Professional Plan": {
      amount: 79.0,
      currencyCode: "USD",
      interval: BillingInterval.Every30Days as any,
      trialDays: 7,
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
