import { createCookie } from "@remix-run/node";
import { randomBytes } from "crypto";

export const csrfCookie = createCookie("csrf", {
  httpOnly: true,
  sameSite: "strict",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24, // 24 hours
});

export function generateCSRFToken(): string {
  return randomBytes(32).toString("hex");
}

export async function validateCSRF(request: Request): Promise<boolean> {
  const cookieHeader = request.headers.get("Cookie");
  const csrfFromCookie = await csrfCookie.parse(cookieHeader);
  const csrfFromHeader = request.headers.get("X-CSRF-Token");

  return csrfFromCookie === csrfFromHeader && !!csrfFromCookie;
}
