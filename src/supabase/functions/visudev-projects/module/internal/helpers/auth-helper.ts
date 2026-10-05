/**
 * Optional JWT auth for IDOR mitigation. Returns user id from Bearer token or null.
 * Guest mode: X-VisuDev-Guest: localhost on local Supabase only.
 */
import { createClient } from "@jsr/supabase__supabase-js";
import type { Context } from "hono";

export const VISUDEV_GUEST_OWNER_ID = "visudev-local-guest";

function isSupabaseLocalDockerStack(): boolean {
  const dbUrl = Deno.env.get("SUPABASE_DB_URL") ?? "";
  if (dbUrl.includes("@db:") || dbUrl.includes("@db/")) return true;
  return Boolean(Deno.env.get("SUPABASE_INTERNAL_HOST_PORT"));
}

/**
 * Pick a Supabase API URL that works in the current runtime:
 * - Docker edge runtime: keep kong (127.0.0.1 is the container itself)
 * - Host-side functions serve: map kong → 127.0.0.1
 */
export function resolveSupabaseUrlForRuntime(): string {
  const raw = Deno.env.get("SUPABASE_URL") ?? "";
  const dbUrl = Deno.env.get("SUPABASE_DB_URL") ?? "";

  if (dbUrl.includes("@db:") || dbUrl.includes("@db/")) {
    return "http://kong:8000";
  }

  if (!raw) return raw;

  try {
    const host = new URL(raw).hostname.toLowerCase();
    if (host === "kong" || host.includes("kong")) {
      return "http://127.0.0.1:54321";
    }
  } catch (error) {
    console.warn(
      "[resolveSupabaseUrlForRuntime] invalid SUPABASE_URL",
      error instanceof Error ? error.message : String(error),
    );
  }
  return raw;
}

export async function getUserIdOptional(c: Context): Promise<string | null> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (anonKey && token === anonKey) return null;
  const url = resolveSupabaseUrlForRuntime();
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) return null;
  try {
    const supabase = createClient(url, serviceRole);
    const { data } = await supabase.auth.getUser(token);
    return data?.user?.id ?? null;
  } catch (e) {
    console.warn(
      "[getUserIdOptional] auth.getUser failed",
      e instanceof Error ? e.message : String(e),
    );
    return null;
  }
}

/** JWT user id, or localhost guest id when explicitly enabled + local Docker stack + shared token. */
export async function resolveRequestUserId(c: Context): Promise<string | null> {
  const jwtUserId = await getUserIdOptional(c);
  if (jwtUserId) return jwtUserId;
  if (!isSupabaseLocalDockerStack()) return null;
  if (Deno.env.get("VISUDEV_ALLOW_GUEST")?.trim() !== "1") return null;
  const guestToken = Deno.env.get("VISUDEV_LOCAL_GUEST_TOKEN")?.trim();
  if (!guestToken) return null;
  const guestHeader = c.req.header("X-VisuDev-Guest")?.trim().toLowerCase();
  const guestTokenHeader = c.req.header("X-VisuDev-Guest-Token")?.trim();
  if (guestHeader === "localhost" && guestTokenHeader === guestToken) {
    return VISUDEV_GUEST_OWNER_ID;
  }
  return null;
}
