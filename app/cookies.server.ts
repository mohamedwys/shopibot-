import { createCookie } from "@remix-run/node";

export const localeCookie = createCookie("locale", {
  path: "/",       // send cookie to all routes
  httpOnly: false, // allow JS to read if needed
  sameSite: "lax", // works in Shopify iframe
  maxAge: 60 * 60 * 24 * 30, // 30 days
  secure: true,    // required for sameSite=None if cross-site
});
