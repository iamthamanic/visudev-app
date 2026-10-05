/**
 * VisuDEV Edge Function: Preview
 *
 * Calls external Preview Runner to build/run app from repo; stores preview URL/status in KV.
 * Routes: POST /preview/start, GET /preview/status, POST /preview/stop
 * Auth: valid user JWT required (reduces IDOR). Per-user rate limit: 30 req/min per action (start/status/stop).
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createClient } from "@jsr/supabase__supabase-js";

const KV_TABLE = "kv_store_edf036ef";

function validateProjectId(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length < 1 || raw.length > 128) {
    return null;
  }
  return /^[a-zA-Z0-9_-]+$/.test(raw) ? raw : null;
}

const kvClient = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

async function kvGet(key: string): Promise<unknown> {
  const supabase = kvClient();
  const { data, error } = await supabase
    .from(KV_TABLE)
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.value;
}

async function kvSet(key: string, value: unknown): Promise<void> {
  const supabase = kvClient();
  const { error } = await supabase.from(KV_TABLE).upsert({ key, value });
  if (error) throw new Error(error.message);
}

const RATE_WINDOW_SEC = 60;
const RATE_MAX_PER_WINDOW = 30;

/** Returns true if request allowed, false if rate limited. Updates KV only when allowing. */
async function checkRateLimit(
  userId: string,
  action: string,
): Promise<boolean> {
  const key = `rate:preview:${userId}:${action}`;
  const raw = await kvGet(key) as
    | { count?: number; windowStart?: string }
    | null;
  const now = Date.now();
  const windowStartMs = raw?.windowStart
    ? new Date(raw.windowStart).getTime()
    : 0;
  const inWindow = now - windowStartMs < RATE_WINDOW_SEC * 1000;
  const prevCount = inWindow && typeof raw?.count === "number" ? raw.count : 0;
  const count = prevCount + 1;
  if (count > RATE_MAX_PER_WINDOW) return false;
  const newWindowStart = inWindow
    ? (raw?.windowStart ?? new Date(now).toISOString())
    : new Date(now).toISOString();
  await kvSet(key, { count, windowStart: newWindowStart });
  return true;
}

type PreviewState = {
  runId: string;
  status: "starting" | "ready" | "failed" | "stopped";
  previewUrl?: string;
  error?: string;
  startedAt: string;
  expiresAt?: string;
  /** Set on start; only this user may call status/stop (reduces IDOR). */
  userId?: string;
};

const app = new Hono();

app.use("*", logger(console.log));
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

/** If Authorization is a valid user JWT, return { ok: true, user }. Else return { ok: false } (caller may allow anon for backward compatibility). */
async function checkAuth(
  c: { req: { header: (name: string) => string | undefined } },
) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false as const };
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    return { ok: false as const };
  }
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) {
    return { ok: false as const };
  }
  return { ok: true as const, user };
}

// POST /preview/start — body: { projectId, repo?, branchOrCommit? }. Auth: require valid user JWT (reduces IDOR).
app.post("/preview/start", async (c) => {
  try {
    const auth = await checkAuth(c);
    if (!auth.ok) {
      return c.json({
        success: false,
        error: "Unauthorized (valid user session required)",
      }, 401);
    }
    if (!(await checkRateLimit(auth.user.id, "start"))) {
      return c.json(
        { success: false, error: "Too many requests; try again later" },
        429,
      );
    }

    const runnerUrl = Deno.env.get("PREVIEW_RUNNER_URL");
    if (!runnerUrl) {
      return c.json(
        { success: false, error: "PREVIEW_RUNNER_URL not configured" },
        503,
      );
    }

    const body = await c.req.json().catch(() => ({}));
    const projectId = validateProjectId(body.projectId);
    if (!projectId) {
      return c.json(
        {
          success: false,
          error: "projectId required (1–128 chars, alphanumeric, - _)",
        },
        400,
      );
    }

    let repo = body.repo as string | undefined;
    let branch = (body.branchOrCommit as string) ?? "main";
    const rawCommitSha = body.commitSha as string | undefined;
    const commitSha = typeof rawCommitSha === "string" &&
        /^[a-f0-9]{40}$/i.test(rawCommitSha.trim())
      ? rawCommitSha.trim()
      : undefined;
    const project = await kvGet(`project:${projectId}`) as
      | Record<string, unknown>
      | null;
    const ownerId = project?.ownerId as string | undefined;
    if (ownerId == null || ownerId === "" || ownerId !== auth.user.id) {
      return c.json(
        { success: false, error: "Forbidden (not project owner)" },
        403,
      );
    }
    if (project) {
      repo = (project.github_repo as string) ?? repo;
      branch = (project.github_branch as string) ?? branch;
    }
    if (!repo) {
      return c.json(
        {
          success: false,
          error: "repo (or project with github_repo) is required",
        },
        400,
      );
    }
    const repoTrimmed = typeof repo === "string" ? repo.trim() : "";
    if (
      repoTrimmed.length > 256 ||
      !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repoTrimmed)
    ) {
      return c.json(
        { success: false, error: "repo must be owner/repo (max 256 chars)" },
        400,
      );
    }
    const branchTrimmed = typeof branch === "string"
      ? String(branch).trim().slice(0, 512)
      : "main";
    const branchSafe = branchTrimmed || "main";

    const runnerRes = await fetch(`${runnerUrl.replace(/\/$/, "")}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repo: repoTrimmed,
        branchOrCommit: branchSafe,
        projectId,
        ...(commitSha ? { commitSha } : {}),
      }),
    });

    const runnerText = await runnerRes.text();
    if (!runnerRes.ok) {
      console.error("Runner start failed", runnerRes.status, runnerText);
      return c.json(
        { success: false, error: `Runner error: ${runnerRes.status}` },
        502,
      );
    }

    let runnerData: { success?: boolean; runId?: string; status?: string };
    try {
      runnerData = JSON.parse(runnerText) as typeof runnerData;
    } catch {
      console.error("Runner returned invalid JSON", runnerText.slice(0, 200));
      return c.json(
        {
          success: false,
          error:
            "Preview Runner returned invalid response (not JSON). Is the Runner running and reachable?",
        },
        502,
      );
    }
    const runId = runnerData.runId ?? "";
    const status = (runnerData.status as PreviewState["status"]) ?? "starting";

    const previewState: PreviewState = {
      runId,
      status,
      startedAt: new Date().toISOString(),
      userId: auth.user.id,
    };
    await kvSet(`preview:${projectId}`, previewState);

    return c.json({
      success: true,
      runId,
      status,
    });
  } catch (e) {
    console.error("preview/start", e);
    return c.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "Internal error",
      },
      500,
    );
  }
});

// GET /preview/status?projectId=xxx — requires valid user JWT
app.get("/preview/status", async (c) => {
  try {
    const auth = await checkAuth(c);
    if (!auth.ok) {
      return c.json({
        success: false,
        error: "Unauthorized (valid user session required)",
      }, 401);
    }
    if (!(await checkRateLimit(auth.user.id, "status"))) {
      return c.json(
        { success: false, error: "Too many requests; try again later" },
        429,
      );
    }
    const rawId = c.req.query("projectId");
    const projectId = validateProjectId(rawId);
    if (!projectId) {
      return c.json(
        {
          success: false,
          error: "projectId required (1–128 chars, alphanumeric, - _)",
        },
        400,
      );
    }

    const stored = await kvGet(`preview:${projectId}`) as PreviewState | null;
    if (!stored) {
      return c.json({
        success: true,
        status: "idle",
        previewUrl: undefined,
        error: undefined,
      });
    }
    if (stored.userId != null && stored.userId !== auth.user.id) {
      return c.json(
        {
          success: false,
          error: "Forbidden (preview belongs to another user)",
        },
        403,
      );
    }

    const runnerUrl = Deno.env.get("PREVIEW_RUNNER_URL");
    if (stored.status === "starting" && runnerUrl && stored.runId) {
      try {
        const statusRes = await fetch(
          `${runnerUrl.replace(/\/$/, "")}/status/${stored.runId}`,
        );
        const statusText = await statusRes.text();
        if (statusRes.ok) {
          let data:
            | { status?: string; previewUrl?: string; error?: string }
            | null = null;
          try {
            data = JSON.parse(statusText) as NonNullable<typeof data>;
          } catch {
            console.error(
              "Runner status returned invalid JSON",
              statusText.slice(0, 200),
            );
          }
          if (data !== null) {
            const newStatus = (data.status as PreviewState["status"]) ??
              stored.status;
            const updated: PreviewState = {
              ...stored,
              status: newStatus,
              previewUrl: data.previewUrl ?? stored.previewUrl,
              error: data.error ?? stored.error,
            };
            await kvSet(`preview:${projectId}`, updated);
            return c.json({
              success: true,
              status: updated.status,
              previewUrl: updated.previewUrl,
              error: updated.error,
              startedAt: updated.startedAt,
              expiresAt: updated.expiresAt,
            });
          }
        }
      } catch (e) {
        console.warn(
          "preview/status: runner fetch failed, using stored state",
          e,
        );
      }
    }

    return c.json({
      success: true,
      status: stored.status,
      previewUrl: stored.previewUrl,
      error: stored.error,
      startedAt: stored.startedAt,
      expiresAt: stored.expiresAt,
    });
  } catch (e) {
    console.error("preview/status", e);
    return c.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "Internal error",
      },
      500,
    );
  }
});

// POST /preview/stop — body: { projectId }. Requires valid user JWT.
app.post("/preview/stop", async (c) => {
  try {
    const auth = await checkAuth(c);
    if (!auth.ok) {
      return c.json({
        success: false,
        error: "Unauthorized (valid user session required)",
      }, 401);
    }
    if (!(await checkRateLimit(auth.user.id, "stop"))) {
      return c.json(
        { success: false, error: "Too many requests; try again later" },
        429,
      );
    }
    const body = await c.req.json().catch(() => ({}));
    const projectId = validateProjectId(body.projectId);
    if (!projectId) {
      return c.json(
        {
          success: false,
          error: "projectId required (1–128 chars, alphanumeric, - _)",
        },
        400,
      );
    }

    const stored = await kvGet(`preview:${projectId}`) as PreviewState | null;
    if (!stored) {
      return c.json({ success: true, status: "stopped" });
    }
    if (stored.userId != null && stored.userId !== auth.user.id) {
      return c.json(
        {
          success: false,
          error: "Forbidden (preview belongs to another user)",
        },
        403,
      );
    }

    const runnerUrl = Deno.env.get("PREVIEW_RUNNER_URL");
    if (runnerUrl && stored.runId) {
      try {
        await fetch(`${runnerUrl.replace(/\/$/, "")}/stop/${stored.runId}`, {
          method: "POST",
        });
      } catch (e) {
        console.warn(
          "preview/stop: runner stop request failed, updating KV anyway",
          e,
        );
      }
    }

    const updated: PreviewState = {
      ...stored,
      status: "stopped",
    };
    await kvSet(`preview:${projectId}`, updated);

    return c.json({ success: true, status: "stopped" });
  } catch (e) {
    console.error("preview/stop", e);
    return c.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "Internal error",
      },
      500,
    );
  }
});

Deno.serve(app.fetch);
