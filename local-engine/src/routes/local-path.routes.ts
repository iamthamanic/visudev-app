/**
 * Local path browse proxy route (Runner native folder picker).
 * Location: local-engine/src/routes/local-path.routes.ts
 */

import type { Hono } from "hono";
import type { EngineConfig } from "../config.js";
import { resolveValidatedLocalPath } from "../lib/local-path-security.js";
import { fail, ok } from "./http.js";

export function registerLocalPathRoutes(app: Hono, config: EngineConfig): void {
  app.get("/api/local-path/browse", async (c) => {
    const startDir = c.req.query("startDir")?.trim();
    const qs = startDir ? `?startDir=${encodeURIComponent(startDir)}` : "";

    const headers: Record<string, string> = {};
    if (config.runnerSecret) {
      headers["X-VisuDev-Runner-Secret"] = config.runnerSecret;
    }
    let response: Response;
    try {
      response = await fetch(
        `${config.previewRunnerUrl.replace(/\/$/, "")}/browse-local-path${qs}`,
        { headers },
      );
    } catch {
      return fail(
        c,
        "PREVIEW_RUNNER_UNAVAILABLE",
        `Preview Runner is not reachable at ${config.previewRunnerUrl}`,
        503,
      );
    }

    const text = await response.text();
    let payload: {
      success?: boolean;
      cancelled?: boolean;
      path?: string;
      error?: string;
    };
    try {
      payload = text ? (JSON.parse(text) as typeof payload) : {};
    } catch {
      return fail(c, "RUNNER_INVALID_JSON", "Preview Runner returned invalid JSON", 502);
    }

    if (payload.cancelled) {
      return ok(c, { cancelled: true as const });
    }

    if (!response.ok || payload.success === false || !payload.path) {
      return fail(
        c,
        "BROWSE_LOCAL_PATH_FAILED",
        payload.error || `Runner error ${response.status}`,
        response.status || 400,
      );
    }

    const validated = resolveValidatedLocalPath(payload.path);
    if (!validated.ok) {
      return fail(c, "LOCAL_PATH_FORBIDDEN", validated.error, 403);
    }

    return ok(c, {
      cancelled: false as const,
      path: validated.path,
      displayPath: validated.path,
    });
  });
}
