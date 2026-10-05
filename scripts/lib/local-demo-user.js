/**
 * Lokaler Demo-User für Hybrid-Dev (nur Docker-Supabase, nicht Cloud).
 * Location: scripts/lib/local-demo-user.js
 *
 * Password is never hardcoded — set LOCAL_DEMO_AUTH_PASSWORD or VITE_DEMO_AUTH_PASSWORD.
 */

/** @readonly */
const LOCAL_DEMO_AUTH_EMAIL = "demo@visudev.local";

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
function resolveLocalDemoAuthPassword(env = process.env) {
  const fromLocal =
    typeof env.LOCAL_DEMO_AUTH_PASSWORD === "string" ? env.LOCAL_DEMO_AUTH_PASSWORD.trim() : "";
  if (fromLocal) return fromLocal;
  const fromVite =
    typeof env.VITE_DEMO_AUTH_PASSWORD === "string" ? env.VITE_DEMO_AUTH_PASSWORD : "";
  return fromVite;
}

/**
 * @param {Record<string, unknown>} status
 */
function serviceRoleKeyFromStatus(status) {
  const jwt = (typeof status.SERVICE_ROLE_KEY === "string" && status.SERVICE_ROLE_KEY.trim()) || "";
  if (jwt) return jwt;
  return (typeof status.SECRET_KEY === "string" && status.SECRET_KEY.trim()) || "";
}

/**
 * Inject demo auth into Vite env only when a password is configured.
 * Never hardcodes a default password into the SPA bundle.
 * @param {NodeJS.ProcessEnv} env
 */
function withLocalDemoAuthEnv(env) {
  const out = { ...env };
  const password = resolveLocalDemoAuthPassword(out);
  if (!password) return out;
  if (!out.VITE_DEMO_AUTH_EMAIL) {
    out.VITE_DEMO_AUTH_EMAIL =
      (typeof out.LOCAL_DEMO_AUTH_EMAIL === "string" && out.LOCAL_DEMO_AUTH_EMAIL.trim()) ||
      LOCAL_DEMO_AUTH_EMAIL;
  }
  if (!out.VITE_DEMO_AUTH_PASSWORD) out.VITE_DEMO_AUTH_PASSWORD = password;
  return out;
}

module.exports = {
  LOCAL_DEMO_AUTH_EMAIL,
  resolveLocalDemoAuthPassword,
  serviceRoleKeyFromStatus,
  withLocalDemoAuthEnv,
};
