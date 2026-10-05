/**
 * Gastmodus für localhost: feste Gast-Identität ohne Supabase-Login.
 * Ort: src/lib/visudev/guest-mode.ts
 *
 * Guest token comes from Local Engine (/api/local-guest-token) — never from VITE_*.
 */

import type { User } from "@jsr/supabase__supabase-js";

/** Must match visudev-projects auth-helper VISUDEV_GUEST_OWNER_ID. */
export const VISUDEV_GUEST_USER_ID = "visudev-local-guest";

const GUEST_TOKEN_STORAGE_KEY = "visudev.localGuestToken";

let cachedGuestToken: string | null = null;
let guestTokenFetch: Promise<string | null> | null = null;

export function isLocalHostUI(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

export function shouldUseGuestMode(sessionUserId: string | undefined | null): boolean {
  return isLocalHostUI() && !sessionUserId;
}

export function createGuestUser(): User {
  const now = new Date().toISOString();
  return {
    id: VISUDEV_GUEST_USER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: "guest@visudev.local",
    email_confirmed_at: now,
    phone: "",
    confirmed_at: now,
    last_sign_in_at: now,
    app_metadata: { provider: "guest", providers: ["guest"] },
    user_metadata: { mode: "localhost-guest" },
    identities: [],
    created_at: now,
    updated_at: now,
    is_anonymous: false,
  };
}

export function isGuestUser(user: User | null | undefined): boolean {
  return user?.id === VISUDEV_GUEST_USER_ID;
}

function readStoredGuestToken(): string {
  if (cachedGuestToken) return cachedGuestToken;
  if (typeof sessionStorage === "undefined") return "";
  try {
    const stored = sessionStorage.getItem(GUEST_TOKEN_STORAGE_KEY)?.trim() ?? "";
    cachedGuestToken = stored || null;
    return stored;
  } catch {
    return "";
  }
}

function storeGuestToken(token: string): void {
  cachedGuestToken = token;
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(GUEST_TOKEN_STORAGE_KEY, token);
  } catch {
    /* ignore quota / private mode */
  }
}

/** Fetch guest token from Local Engine once (loopback-only server endpoint). */
export async function ensureLocalGuestToken(): Promise<string | null> {
  if (!isLocalHostUI()) return null;
  const existing = readStoredGuestToken();
  if (existing) return existing;
  if (guestTokenFetch) return guestTokenFetch;

  guestTokenFetch = (async () => {
    const base =
      (typeof import.meta !== "undefined" &&
        (import.meta.env?.VITE_VISUDEV_ENGINE_URL as string | undefined)?.replace(/\/$/, "")) ||
      "http://127.0.0.1:4317";
    try {
      const res = await fetch(`${base}/api/local-guest-token`);
      const payload = (await res.json()) as {
        success?: boolean;
        data?: { token?: string };
      };
      const token = payload.data?.token?.trim() ?? "";
      if (res.ok && payload.success && token) {
        storeGuestToken(token);
        return token;
      }
    } catch (error) {
      console.warn(
        "[guest-mode] local guest token unavailable",
        error instanceof Error ? error.message : error,
      );
    }
    return null;
  })();

  try {
    return await guestTokenFetch;
  } finally {
    guestTokenFetch = null;
  }
}

export function guestRequestHeader(): Record<string, string> {
  if (!isLocalHostUI()) return {};
  const token = readStoredGuestToken();
  if (!token) return {};
  return {
    "X-VisuDev-Guest": "localhost",
    "X-VisuDev-Guest-Token": token,
  };
}
