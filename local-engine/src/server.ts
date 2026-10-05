/**
 * Hono server bootstrap for VisuDEV Local Engine.
 * Location: local-engine/src/server.ts
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import fs from "node:fs/promises";
import path from "node:path";
import { getEngineConfig, type EngineConfig } from "./config.js";
import { ensureVisuDevDir, readJsonFile, writeJsonFile } from "./storage/file-store.js";
import { LocalPreviewRunnerProvider } from "./providers/local-preview-runner.provider.js";
import { ProjectService } from "./services/project.service.js";
import { AnalysisService } from "./services/analysis.service.js";
import { PreviewService } from "./services/preview.service.js";
import { MigrationService } from "./services/migration.service.js";
import { registerHealthRoutes } from "./routes/health.routes.js";
import { registerProjectRoutes } from "./routes/projects.routes.js";
import { registerAnalysisRoutes } from "./routes/analysis.routes.js";
import { registerPreviewRoutes } from "./routes/preview.routes.js";
import { registerMigrationRoutes } from "./routes/migration.routes.js";
import { registerLocalPathRoutes } from "./routes/local-path.routes.js";
import { registerGitRoutes } from "./routes/git.routes.js";
import { GitSummaryService } from "./services/git-summary.service.js";

async function acquireEngineLock(storageDir: string, port: number): Promise<void> {
  const lockPath = path.join(storageDir, "engine.lock");
  const existing = await readJsonFile<{ pid?: number } | null>(lockPath, null);
  if (existing?.pid) {
    try {
      process.kill(existing.pid, 0);
      throw new Error(`Another Local Engine instance is already running (pid ${existing.pid}).`);
    } catch (error) {
      if (error instanceof Error && error.message.includes("already running")) {
        throw error;
      }
    }
  }
  await writeJsonFile(lockPath, {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    port,
  });
}

export async function createApp(config: EngineConfig = getEngineConfig()) {
  await ensureVisuDevDir(config.storageDir);
  await acquireEngineLock(config.storageDir, config.port);

  const previewProvider = new LocalPreviewRunnerProvider(
    config.previewRunnerUrl,
    config.storageDir,
    config.runnerSecret,
  );
  const projectService = new ProjectService(config.storageDir, previewProvider);
  await projectService.init();
  const analysisService = new AnalysisService(
    config.storageDir,
    projectService,
    config.previewRunnerUrl,
    config,
  );
  const previewService = new PreviewService(config.storageDir, projectService, previewProvider);
  const migrationService = new MigrationService(config.storageDir, projectService);
  const gitSummaryService = new GitSummaryService(projectService);

  const baseUrl = `http://${config.host}:${config.port}`;
  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: (origin) => {
        if (!origin) return config.allowedOrigins[0] ?? "http://localhost:3005";
        return config.allowedOrigins.includes(origin) ? origin : null;
      },
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "X-VisuDev-Engine-Secret",
        "X-VisuDev-Guest",
        "X-VisuDev-Guest-Token",
      ],
    }),
  );

  if (config.engineSecret) {
    app.use("*", async (c, next) => {
      if (c.req.path === "/health" || c.req.path === "/api/health") {
        await next();
        return;
      }
      const provided = c.req.header("X-VisuDev-Engine-Secret")?.trim() ?? "";
      if (provided !== config.engineSecret) {
        return c.json({ success: false, error: "Missing or invalid engine secret." }, 401);
      }
      await next();
    });
  }

  // Guest token is only served when explicitly enabled; engine binds loopback by default.
  // Disabled → HTTP 200 + success:false (not 404): Chromium logs failed fetches as console.error
  // and would trip Product Readiness console gate even when the client handles the miss.
  app.get("/api/local-guest-token", (c) => {
    if (!config.allowGuest || !config.localGuestToken) {
      return c.json({
        success: false,
        error: "Guest mode disabled. Set VISUDEV_ALLOW_GUEST=1 and VISUDEV_LOCAL_GUEST_TOKEN.",
        data: { enabled: false },
      });
    }
    return c.json({
      success: true,
      data: { token: config.localGuestToken, enabled: true },
    });
  });

  registerHealthRoutes(app, config);
  registerProjectRoutes(app, projectService);
  registerAnalysisRoutes(app, analysisService, baseUrl);
  registerPreviewRoutes(app, previewService);
  registerMigrationRoutes(app, migrationService);
  registerLocalPathRoutes(app, config);
  registerGitRoutes(app, gitSummaryService);

  return { app, config };
}

export async function startServer(config: EngineConfig = getEngineConfig()) {
  const { serve } = await import("@hono/node-server");
  const { app, config: resolved } = await createApp(config);
  const server = serve({
    fetch: app.fetch,
    hostname: resolved.host,
    port: resolved.port,
  });

  console.warn(
    `[visudev-local-engine] listening on http://${resolved.host}:${resolved.port} (storage: ${resolved.storageDir})`,
  );

  const shutdown = async () => {
    try {
      await fs.rm(path.join(resolved.storageDir, "engine.lock"), { force: true });
    } catch {
      /* ignore */
    }
    server.close();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  return server;
}
