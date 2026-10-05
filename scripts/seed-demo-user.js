#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * CLI: Demo-User in lokalem Supabase anlegen (npm run seed:demo-user).
 * Location: scripts/seed-demo-user.js
 */
const { createSupabaseStatusClient } = require("./lib/hybrid-supabase-status");
const { ensureLocalDemoUserFromStatus } = require("./lib/seed-demo-user");
const { LOCAL_DEMO_AUTH_EMAIL, resolveLocalDemoAuthPassword } = require("./lib/local-demo-user");

function fail(message, code = 1) {
  console.error(`[seed-demo-user] ${message}`);
  process.exit(code);
}

async function main() {
  const statusClient = createSupabaseStatusClient();
  let result = statusClient.readSupabaseStatus();
  if (!result.ok || !result.status?.API_URL) {
    console.log("[seed-demo-user] Supabase nicht aktiv — starte supabase start …");
    const start = statusClient.startSupabaseStack();
    if (!start.ok) fail(start.error ?? "supabase start fehlgeschlagen", start.exitCode ?? 1);
    result = statusClient.readSupabaseStatus();
    if (!result.ok || !result.status?.API_URL) {
      fail(result.error ?? "supabase status lieferte keine API_URL");
    }
  }

  const seed = await ensureLocalDemoUserFromStatus(result.status);
  if (!seed.ok) fail(seed.error ?? "unbekannter Fehler");

  console.log(
    seed.created
      ? `[seed-demo-user] Demo-User angelegt: ${seed.email}`
      : `[seed-demo-user] Demo-User existiert bereits: ${seed.email}`,
  );
  const password = resolveLocalDemoAuthPassword();
  console.log(`  E-Mail:   ${LOCAL_DEMO_AUTH_EMAIL}`);
  console.log(
    `  Passwort: ${password ? "(gesetzt via Env)" : "(fehlt — LOCAL_DEMO_AUTH_PASSWORD)"}`,
  );
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});
