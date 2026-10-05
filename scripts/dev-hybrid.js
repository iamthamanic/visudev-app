#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Default dev CLI — local Supabase (start + functions serve) + dev-auto (Vite + runners).
 * Location: scripts/dev-hybrid.js
 */
const path = require("path");
const { applyEnvFile } = require("./lib/load-env-file");
const { createHybridProcessGuards } = require("./lib/hybrid-process-guards");
const {
  prepareHybridDevEnv,
  startHybridDevServers,
  healthUrlForSupabase,
} = require("./lib/hybrid-dev-orchestrator");
const { ensureLocalDemoUserFromStatus } = require("./lib/seed-demo-user");
const { LOCAL_DEMO_AUTH_EMAIL, resolveLocalDemoAuthPassword } = require("./lib/local-demo-user");

const ROOT = path.join(__dirname, "..");

const { registerChild, shutdownAll, isShuttingDown, installProcessGuards } =
  createHybridProcessGuards();

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function fail(message, exitCode = 1) {
  console.error(`[dev-hybrid] ${message}`);
  shutdownAll("SIGTERM");
  process.exit(exitCode);
}

async function main() {
  installProcessGuards();
  applyEnvFile(path.join(ROOT, ".env.local"));

  const prep = prepareHybridDevEnv();
  if (!prep.ok) fail(prep.error, prep.exitCode ?? 1);

  if (prep.startedStack) {
    console.log("[dev-hybrid] Lokaler Supabase-Stack nicht aktiv — starte supabase start …");
  }

  Object.assign(process.env, prep.env);
  console.log(`[dev-hybrid] VITE_SUPABASE_URL=${prep.env.VITE_SUPABASE_URL}`);

  if (prep.status) {
    const seed = await ensureLocalDemoUserFromStatus(prep.status);
    if (!seed.ok) {
      console.warn(`[dev-hybrid] Demo-User: ${seed.error}`);
    } else {
      console.log(
        seed.created
          ? `[dev-hybrid] Demo-User angelegt: ${LOCAL_DEMO_AUTH_EMAIL}`
          : `[dev-hybrid] Demo-User bereit: ${LOCAL_DEMO_AUTH_EMAIL}`,
      );
      const demoPassword = resolveLocalDemoAuthPassword();
      if (demoPassword) {
        console.log(`[dev-hybrid] Login: ${LOCAL_DEMO_AUTH_EMAIL} (Passwort via Env gesetzt)`);
      } else {
        console.log(
          `[dev-hybrid] Demo-Login ohne Passwort-Env — setze LOCAL_DEMO_AUTH_PASSWORD für Auto-Login.`,
        );
      }
    }
  }

  console.log("[dev-hybrid] Starte functions serve + App parallel …");
  console.log(
    `[dev-hybrid] Edge Functions werden im Hintergrund bereit (${healthUrlForSupabase(prep.env.VITE_SUPABASE_URL)}) …`,
  );

  const result = await startHybridDevServers({
    env: process.env,
    registerChild,
    isShuttingDown,
    onHealthOk: () => console.log("[dev-hybrid] Supabase Auth health OK."),
  });

  shutdownAll("SIGTERM");
  if (!result.ok) fail(result.error, result.exitCode ?? 1);
  process.exit(result.exitCode);
}

main().catch((err) => {
  fail(`Fehler: ${errorMessage(err)}`);
});
