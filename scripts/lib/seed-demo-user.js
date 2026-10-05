/**
 * Legt den lokalen Demo-User per Supabase Admin API an (idempotent).
 * Location: scripts/lib/seed-demo-user.js
 */
const {
  LOCAL_DEMO_AUTH_EMAIL,
  resolveLocalDemoAuthPassword,
  serviceRoleKeyFromStatus,
} = require("./local-demo-user");
const { isLocalSupabaseUrl } = require("./supabase-local");

/**
 * @param {{ apiUrl: string, serviceRoleKey: string, email?: string, password?: string, fetchFn?: typeof fetch }} options
 */
async function ensureLocalDemoUser(options) {
  const email = options.email ?? LOCAL_DEMO_AUTH_EMAIL;
  const password = options.password ?? resolveLocalDemoAuthPassword();
  const fetchFn = options.fetchFn ?? fetch;

  if (!isLocalSupabaseUrl(options.apiUrl)) {
    return { ok: false, error: "Demo-User wird nur für lokale Supabase-URLs angelegt." };
  }
  if (!password) {
    return {
      ok: false,
      error: "Demo-Passwort fehlt. Setze LOCAL_DEMO_AUTH_PASSWORD oder VITE_DEMO_AUTH_PASSWORD.",
    };
  }
  if (!options.serviceRoleKey?.trim()) {
    return { ok: false, error: "SERVICE_ROLE_KEY fehlt in supabase status." };
  }

  const base = options.apiUrl.trim().replace(/\/+$/, "");
  const key = options.serviceRoleKey.trim();
  const res = await fetchFn(`${base}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
    }),
  });

  if (res.ok) return { ok: true, created: true, email };

  const body = await res.text();
  if (res.status === 422 && /already|registered|exists|duplicate|unique/i.test(body)) {
    return { ok: true, created: false, email };
  }

  return {
    ok: false,
    error: `Demo-User konnte nicht angelegt werden (${res.status}): ${body.slice(0, 240)}`,
  };
}

/**
 * @param {Record<string, unknown>} status
 * @param {{ fetchFn?: typeof fetch }} [deps]
 */
async function ensureLocalDemoUserFromStatus(status, deps = {}) {
  const apiUrl =
    (typeof status.API_URL === "string" && status.API_URL.trim()) || "http://127.0.0.1:54321";
  return ensureLocalDemoUser({
    apiUrl,
    serviceRoleKey: serviceRoleKeyFromStatus(status),
    fetchFn: deps.fetchFn,
  });
}

module.exports = { ensureLocalDemoUser, ensureLocalDemoUserFromStatus };
