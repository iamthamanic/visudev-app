/**
 * Legacy monolith: KV, projects, appflow, blueprint, data, logs, account, integrations, scans. Splitting by domain (SRP) and injecting kv (DI) is planned.
 * IDOR: getUserIdOptional + requireProjectOwner on all project-scoped routes; ownerId on POST /projects. Data Leakage: redactIntegrations on all GET/PUT integrations.
 */
import { createClient } from "@jsr/supabase__supabase-js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { z } from "zod";

const createProjectBodySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().max(500).optional(),
}).passthrough();

const createLogBodySchema = z.object({
  message: z.string().max(10_000).optional(),
  level: z.enum(["info", "warn", "error", "debug"]).optional(),
}).passthrough();

const updateIntegrationsBodySchema = z.record(z.unknown()).refine(
  (obj) =>
    Object.keys(obj).length <= 20 && JSON.stringify(obj).length <= 50_000,
  { message: "Integrations payload too large" },
);
const updateAccountBodySchema = z.record(z.unknown()).refine(
  (obj) => JSON.stringify(obj).length <= 20_000,
  { message: "Account payload too large" },
);

const RATE_WINDOW_MS = 60_000;
const RATE_MAX_LOGS_PER_WINDOW = 120;
const RATE_MAX_PROJECTS_PER_WINDOW = 30;

/** Returns true if under limit; otherwise false. Uses KV for sliding window. */
async function checkRateLimit(
  key: string,
  maxPerWindow: number,
): Promise<boolean> {
  const raw = (await kv.get(key)) as
    | { count?: number; windowStart?: string }
    | null;
  const now = Date.now();
  const windowStartMs = raw?.windowStart
    ? new Date(raw.windowStart).getTime()
    : 0;
  const inWindow = now - windowStartMs < RATE_WINDOW_MS;
  const prevCount = inWindow && typeof raw?.count === "number" ? raw.count : 0;
  const count = prevCount + 1;
  if (count > maxPerWindow) return false;
  const newWindowStart = inWindow
    ? (raw?.windowStart ?? new Date(now).toISOString())
    : new Date(now).toISOString();
  await kv.set(key, { count, windowStart: newWindowStart });
  return true;
}

// ==================== HELPERS ====================
/** Redact sensitive fields before sending to client (Data Leakage prevention). Never return raw tokens/keys. */
function redactIntegrations(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object") return {};
  const out = { ...(data as Record<string, unknown>) };
  if (out.github && typeof out.github === "object") {
    out.github = { ...(out.github as Record<string, unknown>) };
    (out.github as Record<string, unknown>).token = "***";
  }
  if (out.supabase && typeof out.supabase === "object") {
    out.supabase = { ...(out.supabase as Record<string, unknown>) };
    const s = out.supabase as Record<string, unknown>;
    s.anonKey = "***";
    s.serviceKey = "***";
  }
  return out;
}

// ==================== KV STORE ====================
const kvClient = () =>
  createClient(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  );

const kv = {
  set: async (key: string, value: unknown): Promise<void> => {
    const supabase = kvClient();
    const { error } = await supabase.from("kv_store_edf036ef").upsert({
      key,
      value,
    });
    if (error) {
      throw new Error(error.message);
    }
  },

  get: async (key: string): Promise<unknown> => {
    const supabase = kvClient();
    const { data, error } = await supabase
      .from("kv_store_edf036ef")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    return data?.value;
  },

  del: async (key: string): Promise<void> => {
    const supabase = kvClient();
    const { error } = await supabase.from("kv_store_edf036ef").delete().eq(
      "key",
      key,
    );
    if (error) {
      throw new Error(error.message);
    }
  },

  mset: async (keys: string[], values: unknown[]): Promise<void> => {
    const supabase = kvClient();
    const { error } = await supabase
      .from("kv_store_edf036ef")
      .upsert(keys.map((k, i) => ({ key: k, value: values[i] })));
    if (error) {
      throw new Error(error.message);
    }
  },

  mget: async (keys: string[]): Promise<unknown[]> => {
    const supabase = kvClient();
    const { data, error } = await supabase
      .from("kv_store_edf036ef")
      .select("value")
      .in("key", keys);
    if (error) {
      throw new Error(error.message);
    }
    return data?.map((d) => d.value) ?? [];
  },

  mdel: async (keys: string[]): Promise<void> => {
    const supabase = kvClient();
    const { error } = await supabase.from("kv_store_edf036ef").delete().in(
      "key",
      keys,
    );
    if (error) {
      throw new Error(error.message);
    }
  },

  getByPrefix: async (prefix: string): Promise<unknown[]> => {
    const supabase = kvClient();
    const { data, error } = await supabase
      .from("kv_store_edf036ef")
      .select("key, value")
      .like("key", prefix + "%");
    if (error) {
      throw new Error(error.message);
    }
    return data?.map((d) => d.value) ?? [];
  },
};

/** Optional auth: returns user id from Bearer JWT or null (IDOR mitigation). */
async function getUserIdOptional(
  c: { req: { header: (name: string) => string | undefined } },
): Promise<string | null> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) return null;
  try {
    const supabase = createClient(url, serviceRole);
    const { data } = await supabase.auth.getUser(token);
    return data?.user?.id ?? null;
  } catch (e) {
    console.warn("[getUserIdOptional] auth.getUser failed", {
      message: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

type ProjectRecord = Record<string, unknown> & { ownerId?: string };

/** Ownership check for project-scoped routes (IDOR mitigation). */
async function requireProjectOwner(
  c: Parameters<typeof getUserIdOptional>[0],
  projectId: string,
): Promise<
  | { ok: true; project: ProjectRecord }
  | { ok: false; status: 403 | 404 }
> {
  const project = (await kv.get(`project:${projectId}`)) as
    | ProjectRecord
    | null;
  if (!project) return { ok: false, status: 404 };
  const ownerId = project.ownerId;
  const userId = await getUserIdOptional(c);
  if (userId === null) return { ok: false, status: 403 };
  if (ownerId == null || ownerId === "" || userId !== ownerId) {
    return { ok: false, status: 403 };
  }
  return { ok: true, project };
}

const app = new Hono();

// Enable logger
app.use("*", logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

// ==================== PROJECTS ====================
// Get all projects (IDOR: filter by owner when JWT present)
// IDOR: no JWT → empty list; with JWT → filter by owner
app.get("/projects", async (c) => {
  try {
    const userId = await getUserIdOptional(c);
    if (userId == null) {
      return c.json({ success: true, data: [] });
    }
    let projects = (await kv.getByPrefix("project:")) as ProjectRecord[];
    projects = projects.filter(
      (p) => p.ownerId === userId,
    );
    return c.json({ success: true, data: projects });
  } catch (error) {
    console.log(`Error fetching projects: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Get single project (IDOR: ownership required when project has ownerId)
app.get("/projects/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const own = await requireProjectOwner(c, id);
    if (!own.ok) {
      return c.json(
        {
          success: false,
          error: own.status === 404 ? "Project not found" : "Forbidden",
        },
        own.status,
      );
    }
    return c.json({ success: true, data: own.project });
  } catch (error) {
    console.log(`Error fetching project: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Create project (set ownerId from JWT when present)
app.post("/projects", async (c) => {
  try {
    if (
      !(await checkRateLimit(
        "rate:projects:create",
        RATE_MAX_PROJECTS_PER_WINDOW,
      ))
    ) {
      return c.json({ success: false, error: "Rate limit exceeded" }, 429);
    }
    const raw = await c.req.json();
    const parsed = createProjectBodySchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ success: false, error: parsed.error.message }, 400);
    }
    const body = parsed.data as Record<string, unknown>;
    const id = (body.id as string) || crypto.randomUUID();
    const ownerId = (await getUserIdOptional(c)) ?? undefined;
    const project = {
      ...body,
      id,
      ownerId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`project:${id}`, project);
    return c.json({ success: true, data: project });
  } catch (error) {
    console.log(`Error creating project: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Update project (IDOR: ownership required)
app.put("/projects/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const own = await requireProjectOwner(c, id);
    if (!own.ok) {
      return c.json(
        {
          success: false,
          error: own.status === 404 ? "Project not found" : "Forbidden",
        },
        own.status,
      );
    }
    const body = await c.req.json();
    const updated = {
      ...own.project,
      ...body,
      id,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`project:${id}`, updated);
    return c.json({ success: true, data: updated });
  } catch (error) {
    console.log(`Error updating project: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Delete project (IDOR: ownership required)
app.delete("/projects/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const own = await requireProjectOwner(c, id);
    if (!own.ok) {
      return c.json(
        {
          success: false,
          error: own.status === 404 ? "Project not found" : "Forbidden",
        },
        own.status,
      );
    }
    await kv.del(`project:${id}`);
    return c.json({ success: true });
  } catch (error) {
    console.log(`Error deleting project: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ==================== APP FLOW ====================
// Get flows for project (IDOR: ownership check)
app.get("/appflow/:projectId", async (c) => {
  try {
    const projectId = c.req.param("projectId");
    const own = await requireProjectOwner(c, projectId);
    if (!own.ok) {
      return c.json(
        {
          success: false,
          error: own.status === 404 ? "Project not found" : "Forbidden",
        },
        own.status,
      );
    }
    const flows = await kv.getByPrefix(`appflow:${projectId}:`);
    return c.json({ success: true, data: flows });
  } catch (error) {
    console.log(`Error fetching flows: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Get single flow (IDOR: ownership check)
app.get("/appflow/:projectId/:flowId", async (c) => {
  try {
    const projectId = c.req.param("projectId");
    const own = await requireProjectOwner(c, projectId);
    if (!own.ok) {
      return c.json(
        {
          success: false,
          error: own.status === 404 ? "Project not found" : "Forbidden",
        },
        own.status,
      );
    }
    const flowId = c.req.param("flowId");
    const flow = await kv.get(`appflow:${projectId}:${flowId}`);
    if (!flow) {
      return c.json({ success: false, error: "Flow not found" }, 404);
    }
    return c.json({ success: true, data: flow });
  } catch (error) {
    console.log(`Error fetching flow: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Create flow (IDOR: ownership check)
app.post("/appflow/:projectId", async (c) => {
  try {
    const projectId = c.req.param("projectId");
    const own = await requireProjectOwner(c, projectId);
    if (!own.ok) {
      return c.json(
        {
          success: false,
          error: own.status === 404 ? "Project not found" : "Forbidden",
        },
        own.status,
      );
    }
    const body = await c.req.json();
    const flowId = body.flowId || crypto.randomUUID();
    const flow = {
      ...body,
      flowId,
      projectId,
      createdAt: new Date().toISOString(),
    };
    await kv.set(`appflow:${projectId}:${flowId}`, flow);
    return c.json({ success: true, data: flow });
  } catch (error) {
    console.log(`Error creating flow: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Delete flow (IDOR: ownership check)
app.delete("/appflow/:projectId/:flowId", async (c) => {
  try {
    const projectId = c.req.param("projectId");
    const own = await requireProjectOwner(c, projectId);
    if (!own.ok) {
      return c.json(
        {
          success: false,
          error: own.status === 404 ? "Project not found" : "Forbidden",
        },
        own.status,
      );
    }
    const flowId = c.req.param("flowId");
    await kv.del(`appflow:${projectId}:${flowId}`);
    return c.json({ success: true });
  } catch (error) {
    console.log(`Error deleting flow: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ==================== BLUEPRINT ====================
// Get blueprint for project (IDOR: ownership check)
app.get("/blueprint/:projectId", async (c) => {
  try {
    const projectId = c.req.param("projectId");
    const own = await requireProjectOwner(c, projectId);
    if (!own.ok) {
      return c.json(
        {
          success: false,
          error: own.status === 404 ? "Project not found" : "Forbidden",
        },
        own.status,
      );
    }
    const blueprint = await kv.get(`blueprint:${projectId}`);
    return c.json({ success: true, data: blueprint || {} });
  } catch (error) {
    console.log(`Error fetching blueprint: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Update blueprint (IDOR: ownership check)
app.put("/blueprint/:projectId", async (c) => {
  try {
    const projectId = c.req.param("projectId");
    const own = await requireProjectOwner(c, projectId);
    if (!own.ok) {
      return c.json(
        {
          success: false,
          error: own.status === 404 ? "Project not found" : "Forbidden",
        },
        own.status,
      );
    }
    const body = await c.req.json();
    const blueprint = {
      ...body,
      projectId,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`blueprint:${projectId}`, blueprint);
    return c.json({ success: true, data: blueprint });
  } catch (error) {
    console.log(`Error updating blueprint: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ==================== DATA ====================
// Get schema for project (IDOR: ownership check)
app.get("/data/:projectId/schema", async (c) => {
  try {
    const projectId = c.req.param("projectId");
    const own = await requireProjectOwner(c, projectId);
    if (!own.ok) {
      return c.json(
        {
          success: false,
          error: own.status === 404 ? "Project not found" : "Forbidden",
        },
        own.status,
      );
    }
    const schema = await kv.get(`data:${projectId}:schema`);
    return c.json({ success: true, data: schema || {} });
  } catch (error) {
    console.log(`Error fetching schema: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Update schema (IDOR: ownership check)
app.put("/data/:projectId/schema", async (c) => {
  try {
    const projectId = c.req.param("projectId");
    const own = await requireProjectOwner(c, projectId);
    if (!own.ok) {
      return c.json(
        {
          success: false,
          error: own.status === 404 ? "Project not found" : "Forbidden",
        },
        own.status,
      );
    }
    const body = await c.req.json();
    const schema = {
      ...body,
      projectId,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`data:${projectId}:schema`, schema);
    return c.json({ success: true, data: schema });
  } catch (error) {
    console.log(`Error updating schema: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Get migrations for project (IDOR: ownership check)
app.get("/data/:projectId/migrations", async (c) => {
  try {
    const projectId = c.req.param("projectId");
    const own = await requireProjectOwner(c, projectId);
    if (!own.ok) {
      return c.json(
        {
          success: false,
          error: own.status === 404 ? "Project not found" : "Forbidden",
        },
        own.status,
      );
    }
    const migrations = await kv.get(`data:${projectId}:migrations`);
    return c.json({ success: true, data: migrations || [] });
  } catch (error) {
    console.log(`Error fetching migrations: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Update migrations (IDOR: ownership check)
app.put("/data/:projectId/migrations", async (c) => {
  try {
    const projectId = c.req.param("projectId");
    const own = await requireProjectOwner(c, projectId);
    if (!own.ok) {
      return c.json(
        {
          success: false,
          error: own.status === 404 ? "Project not found" : "Forbidden",
        },
        own.status,
      );
    }
    const body = await c.req.json();
    await kv.set(`data:${projectId}:migrations`, body);
    return c.json({ success: true, data: body });
  } catch (error) {
    console.log(`Error updating migrations: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ==================== LOGS ====================
// Get logs for project (IDOR: ownership check)
app.get("/logs/:projectId", async (c) => {
  try {
    const projectId = c.req.param("projectId");
    const own = await requireProjectOwner(c, projectId);
    if (!own.ok) {
      return c.json(
        {
          success: false,
          error: own.status === 404 ? "Project not found" : "Forbidden",
        },
        own.status,
      );
    }
    const logs = await kv.getByPrefix(`logs:${projectId}:`);
    return c.json({ success: true, data: logs });
  } catch (error) {
    console.log(`Error fetching logs: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Create log entry (IDOR: ownership check)
app.post("/logs/:projectId", async (c) => {
  try {
    const projectId = c.req.param("projectId");
    const own = await requireProjectOwner(c, projectId);
    if (!own.ok) {
      return c.json(
        {
          success: false,
          error: own.status === 404 ? "Project not found" : "Forbidden",
        },
        own.status,
      );
    }
    if (
      !(await checkRateLimit(
        `rate:logs:${projectId}`,
        RATE_MAX_LOGS_PER_WINDOW,
      ))
    ) {
      return c.json({ success: false, error: "Rate limit exceeded" }, 429);
    }
    const raw = await c.req.json();
    const parsed = createLogBodySchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ success: false, error: parsed.error.message }, 400);
    }
    const body = parsed.data as Record<string, unknown>;
    const timestamp = new Date().toISOString();
    const logId = `${timestamp}:${crypto.randomUUID()}`;
    const log = {
      ...body,
      id: logId,
      projectId,
      timestamp,
    };
    // id stored so DELETE /logs/:projectId can build KV keys (logs:projectId:id)
    await kv.set(`logs:${projectId}:${logId}`, log);
    return c.json({ success: true, data: log });
  } catch (error) {
    console.log(`Error creating log: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Delete logs for project (IDOR: ownership check)
app.delete("/logs/:projectId", async (c) => {
  try {
    const projectId = c.req.param("projectId");
    const own = await requireProjectOwner(c, projectId);
    if (!own.ok) {
      return c.json(
        {
          success: false,
          error: own.status === 404 ? "Project not found" : "Forbidden",
        },
        own.status,
      );
    }
    const logs = await kv.getByPrefix(`logs:${projectId}:`);
    const keys = logs
      .map((log: { id?: string }) =>
        log?.id ? `logs:${projectId}:${log.id}` : null
      )
      .filter((k): k is string => k != null);
    if (keys.length > 0) {
      await kv.mdel(keys);
    }
    return c.json({ success: true });
  } catch (error) {
    console.log(`Error deleting logs: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ==================== ACCOUNT ====================
// Get account (IDOR: only owner can read; require JWT matching userId)
app.get("/account/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const authUserId = await getUserIdOptional(c);
    if (authUserId === null || authUserId !== userId) {
      return c.json({ success: false, error: "Forbidden" }, 403);
    }
    const account = await kv.get(`account:${userId}`);
    return c.json({ success: true, data: account || {} });
  } catch (error) {
    console.log(`Error fetching account: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Update account settings (IDOR: only owner can update)
app.put("/account/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const authUserId = await getUserIdOptional(c);
    if (authUserId === null || authUserId !== userId) {
      return c.json({ success: false, error: "Forbidden" }, 403);
    }
    if (!(await checkRateLimit(`rate:account:${userId}`, 30))) {
      return c.json({ success: false, error: "Rate limit exceeded" }, 429);
    }
    const raw = await c.req.json();
    const parsed = updateAccountBodySchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ success: false, error: parsed.error.message }, 400);
    }
    const body = parsed.data as Record<string, unknown>;
    const account = {
      ...body,
      userId,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`account:${userId}`, account);
    return c.json({ success: true, data: account });
  } catch (error) {
    console.log(`Error updating account: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ==================== INTEGRATIONS ====================
// Get integrations for project (IDOR: ownership check; Data Leakage: redactIntegrations)
app.get("/integrations/:projectId", async (c) => {
  try {
    const projectId = c.req.param("projectId");
    const own = await requireProjectOwner(c, projectId);
    if (!own.ok) {
      return c.json(
        {
          success: false,
          error: own.status === 404 ? "Project not found" : "Forbidden",
        },
        own.status,
      );
    }
    const integrations = await kv.get(`integrations:${projectId}`);
    return c.json({
      success: true,
      data: redactIntegrations(integrations ?? {}),
    });
  } catch (error) {
    console.log(`Error fetching integrations: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Update integrations (IDOR: ownership check; GitHub, Supabase, etc.)
app.put("/integrations/:projectId", async (c) => {
  try {
    const projectId = c.req.param("projectId");
    const own = await requireProjectOwner(c, projectId);
    if (!own.ok) {
      return c.json(
        {
          success: false,
          error: own.status === 404 ? "Project not found" : "Forbidden",
        },
        own.status,
      );
    }
    if (!(await checkRateLimit(`rate:integrations:${projectId}`, 30))) {
      return c.json({ success: false, error: "Rate limit exceeded" }, 429);
    }
    const raw = await c.req.json();
    const parsed = updateIntegrationsBodySchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ success: false, error: parsed.error.message }, 400);
    }
    const body = parsed.data as Record<string, unknown>;
    const integrations = {
      ...body,
      projectId,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`integrations:${projectId}`, integrations);
    return c.json({ success: true, data: redactIntegrations(integrations) });
  } catch (error) {
    console.log(`Error updating integrations: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// GitHub: Get repositories (IDOR: ownership check)
app.get("/integrations/:projectId/github/repos", async (c) => {
  try {
    const projectId = c.req.param("projectId");
    const own = await requireProjectOwner(c, projectId);
    if (!own.ok) {
      return c.json(
        {
          success: false,
          error: own.status === 404 ? "Project not found" : "Forbidden",
        },
        own.status,
      );
    }
    const integrations = await kv.get(`integrations:${projectId}`);

    if (!integrations?.github?.token) {
      return c.json({ success: false, error: "GitHub not connected" }, 400);
    }

    const response = await fetch("https://api.github.com/user/repos", {
      headers: {
        Authorization: `token ${integrations.github.token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    const repos = await response.json();
    return c.json({ success: true, data: repos });
  } catch (error) {
    console.log(`Error fetching GitHub repos: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// GitHub: Get file content (IDOR: ownership check)
app.get("/integrations/:projectId/github/content", async (c) => {
  try {
    const projectId = c.req.param("projectId");
    const own = await requireProjectOwner(c, projectId);
    if (!own.ok) {
      return c.json(
        {
          success: false,
          error: own.status === 404 ? "Project not found" : "Forbidden",
        },
        own.status,
      );
    }
    const owner = c.req.query("owner");
    const repo = c.req.query("repo");
    const path = c.req.query("path");
    const ref = c.req.query("ref") || "main";

    if (!owner || !repo || !path) {
      return c.json({ success: false, error: "Missing parameters" }, 400);
    }

    const integrations = await kv.get(`integrations:${projectId}`);

    if (!integrations?.github?.token) {
      return c.json({ success: false, error: "GitHub not connected" }, 400);
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${ref}`,
      {
        headers: {
          Authorization: `token ${integrations.github.token}`,
          Accept: "application/vnd.github.v3+json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    const content = await response.json();
    return c.json({ success: true, data: content });
  } catch (error) {
    console.log(`Error fetching GitHub content: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Supabase: Get project info (IDOR: ownership check; no raw keys in response)
app.get("/integrations/:projectId/supabase/info", async (c) => {
  try {
    const projectId = c.req.param("projectId");
    const own = await requireProjectOwner(c, projectId);
    if (!own.ok) {
      return c.json(
        {
          success: false,
          error: own.status === 404 ? "Project not found" : "Forbidden",
        },
        own.status,
      );
    }
    const integrations = await kv.get(`integrations:${projectId}`);

    if (!integrations?.supabase?.url || !integrations?.supabase?.serviceKey) {
      return c.json({ success: false, error: "Supabase not connected" }, 400);
    }

    // Return configured Supabase info (without exposing service key)
    return c.json({
      success: true,
      data: {
        url: integrations.supabase.url,
        projectRef: integrations.supabase.projectRef,
        connected: true,
      },
    });
  } catch (error) {
    console.log(`Error fetching Supabase info: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ==================== SCANS ====================
// Get scan status for a project (IDOR: ownership check)
app.get("/scans/:projectId/status", async (c) => {
  try {
    const projectId = c.req.param("projectId");
    const own = await requireProjectOwner(c, projectId);
    if (!own.ok) {
      return c.json(
        {
          success: false,
          error: own.status === 404 ? "Project not found" : "Forbidden",
        },
        own.status,
      );
    }
    const appflowStatus = await kv.get(`scan:${projectId}:appflow`);
    const blueprintStatus = await kv.get(`scan:${projectId}:blueprint`);
    const dataStatus = await kv.get(`scan:${projectId}:data`);

    return c.json({
      success: true,
      data: {
        appflow: appflowStatus || { status: "idle", progress: 0 },
        blueprint: blueprintStatus || { status: "idle", progress: 0 },
        data: dataStatus || { status: "idle", progress: 0 },
      },
    });
  } catch (error) {
    console.log(`Error fetching scan status: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Start AppFlow scan (IDOR: ownership check)
app.post("/scans/:projectId/appflow", async (c) => {
  try {
    const projectId = c.req.param("projectId");
    const own = await requireProjectOwner(c, projectId);
    if (!own.ok) {
      return c.json(
        {
          success: false,
          error: own.status === 404 ? "Project not found" : "Forbidden",
        },
        own.status,
      );
    }
    const project = own.project;
    console.log(`[AppFlow Scan] Starting scan for project: ${projectId}`);

    // For now, allow scan even without github_repo (we'll use sample data)
    if (!project.github_repo) {
      console.log(
        `[AppFlow Scan] No GitHub repo configured, using sample data`,
      );
    }

    // Set initial status
    await kv.set(`scan:${projectId}:appflow`, {
      status: "running",
      progress: 0,
      startedAt: new Date().toISOString(),
    });

    console.log(`[AppFlow Scan] Scan started, generating sample data...`);

    // Start async scan (simulated for now - in production this would analyze the repo)
    setTimeout(async () => {
      try {
        // Simulate progress updates
        await kv.set(`scan:${projectId}:appflow`, {
          status: "running",
          progress: 30,
          message: "Analyzing repository structure...",
        });

        await new Promise((resolve) => setTimeout(resolve, 2000));

        await kv.set(`scan:${projectId}:appflow`, {
          status: "running",
          progress: 60,
          message: "Detecting UI components...",
        });

        await new Promise((resolve) => setTimeout(resolve, 2000));

        await kv.set(`scan:${projectId}:appflow`, {
          status: "running",
          progress: 90,
          message: "Generating flow maps...",
        });

        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Complete scan with sample data
        await kv.set(`scan:${projectId}:appflow`, {
          status: "completed",
          progress: 100,
          completedAt: new Date().toISOString(),
        });

        // Store sample flow data WITH PROPER STRUCTURE
        const sampleFlowId = crypto.randomUUID();
        await kv.set(`appflow:${projectId}:${sampleFlowId}`, {
          flowId: sampleFlowId,
          projectId,
          screens: [
            {
              id: "screen-home",
              name: "Home",
              path: "/",
              file: "/src/pages/Home.tsx",
              type: "page",
              flows: ["flow-1", "flow-2"],
              navigatesTo: ["/dashboard", "/login"],
              framework: "react",
              componentCode: "<div><h1>Welcome Home</h1></div>",
              screenshotUrl: null,
              screenshotStatus: "none",
            },
            {
              id: "screen-dashboard",
              name: "Dashboard",
              path: "/dashboard",
              file: "/src/pages/Dashboard.tsx",
              type: "page",
              flows: ["flow-2", "flow-3"],
              navigatesTo: ["/settings", "/profile"],
              framework: "react",
              componentCode:
                "<div><h1>Dashboard</h1><div>Welcome back!</div></div>",
              screenshotUrl: null,
              screenshotStatus: "none",
            },
            {
              id: "screen-login",
              name: "Login",
              path: "/login",
              file: "/src/pages/Login.tsx",
              type: "page",
              flows: ["flow-1"],
              navigatesTo: ["/dashboard"],
              framework: "react",
              componentCode:
                '<div><form><input type="email" /><button>Login</button></form></div>',
              screenshotUrl: null,
              screenshotStatus: "none",
            },
            {
              id: "screen-settings",
              name: "Settings",
              path: "/settings",
              file: "/src/pages/Settings.tsx",
              type: "page",
              flows: ["flow-3"],
              navigatesTo: ["/dashboard"],
              framework: "react",
              componentCode:
                "<div><h1>Settings</h1><div>Configure your app</div></div>",
              screenshotUrl: null,
              screenshotStatus: "none",
            },
            {
              id: "screen-profile",
              name: "Profile",
              path: "/profile",
              file: "/src/pages/Profile.tsx",
              type: "page",
              flows: [],
              navigatesTo: ["/settings"],
              framework: "react",
              componentCode:
                "<div><h1>Profile</h1><div>Your profile information</div></div>",
              screenshotUrl: null,
              screenshotStatus: "none",
            },
          ],
          flows: [
            {
              id: "flow-1",
              type: "ui-event",
              name: "handleLogin",
              file: "/src/pages/Login.tsx",
              line: 42,
              code: "const handleLogin = async () => { ... }",
              calls: ["flow-2"],
              color: "#03ffa3",
            },
            {
              id: "flow-2",
              type: "api-call",
              name: "POST /api/auth/login",
              file: "/src/api/auth.ts",
              line: 12,
              code: 'await fetch("/api/auth/login", { method: "POST" })',
              calls: ["flow-3"],
              color: "#00bcd4",
            },
            {
              id: "flow-3",
              type: "db-query",
              name: "SELECT * FROM users",
              file: "/src/db/queries.ts",
              line: 8,
              code: 'await supabase.from("users").select("*")',
              calls: [],
              color: "#ff6b6b",
            },
          ],
          framework: {
            detected: ["react", "typescript", "tailwind"],
            primary: "react",
            confidence: 0.95,
          },
          createdAt: new Date().toISOString(),
        });
      } catch (error) {
        console.log(`Error during AppFlow scan: ${error}`);
        await kv.set(`scan:${projectId}:appflow`, {
          status: "failed",
          progress: 0,
          error: String(error),
          failedAt: new Date().toISOString(),
        });
      }
    }, 100);

    return c.json({ success: true, message: "AppFlow scan started" });
  } catch (error) {
    console.log(`Error starting AppFlow scan: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Start Blueprint scan
// Start Blueprint scan (IDOR: ownership check)
app.post("/scans/:projectId/blueprint", async (c) => {
  try {
    const projectId = c.req.param("projectId");
    const own = await requireProjectOwner(c, projectId);
    if (!own.ok) {
      return c.json(
        {
          success: false,
          error: own.status === 404 ? "Project not found" : "Forbidden",
        },
        own.status,
      );
    }
    const project = own.project;

    if (!project.github_repo) {
      return c.json(
        { success: false, error: "GitHub repo not configured" },
        400,
      );
    }

    await kv.set(`scan:${projectId}:blueprint`, {
      status: "running",
      progress: 0,
      startedAt: new Date().toISOString(),
    });

    setTimeout(async () => {
      try {
        await kv.set(`scan:${projectId}:blueprint`, {
          status: "running",
          progress: 40,
          message: "Analyzing code structure...",
        });

        await new Promise((resolve) => setTimeout(resolve, 2000));

        await kv.set(`scan:${projectId}:blueprint`, {
          status: "running",
          progress: 80,
          message: "Mapping dependencies...",
        });

        await new Promise((resolve) => setTimeout(resolve, 1500));

        await kv.set(`scan:${projectId}:blueprint`, {
          status: "completed",
          progress: 100,
          completedAt: new Date().toISOString(),
        });

        // Store sample blueprint data
        await kv.set(`blueprint:${projectId}`, {
          projectId,
          components: [
            { name: "App", type: "component", path: "/src/App.tsx" },
            {
              name: "LoginForm",
              type: "component",
              path: "/src/components/LoginForm.tsx",
            },
          ],
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.log(`Error during Blueprint scan: ${error}`);
        await kv.set(`scan:${projectId}:blueprint`, {
          status: "failed",
          progress: 0,
          error: String(error),
          failedAt: new Date().toISOString(),
        });
      }
    }, 100);

    return c.json({ success: true, message: "Blueprint scan started" });
  } catch (error) {
    console.log(`Error starting Blueprint scan: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Start Data scan
// Start Data scan (IDOR: ownership check)
app.post("/scans/:projectId/data", async (c) => {
  try {
    const projectId = c.req.param("projectId");
    const own = await requireProjectOwner(c, projectId);
    if (!own.ok) {
      return c.json(
        {
          success: false,
          error: own.status === 404 ? "Project not found" : "Forbidden",
        },
        own.status,
      );
    }
    const project = own.project;

    if (!project.supabase_project_id) {
      return c.json(
        {
          success: false,
          error: "Supabase project not configured",
        },
        400,
      );
    }

    await kv.set(`scan:${projectId}:data`, {
      status: "running",
      progress: 0,
      startedAt: new Date().toISOString(),
    });

    setTimeout(async () => {
      try {
        await kv.set(`scan:${projectId}:data`, {
          status: "running",
          progress: 35,
          message: "Connecting to database...",
        });

        await new Promise((resolve) => setTimeout(resolve, 1500));

        await kv.set(`scan:${projectId}:data`, {
          status: "running",
          progress: 70,
          message: "Scanning tables and RLS policies...",
        });

        await new Promise((resolve) => setTimeout(resolve, 2000));

        await kv.set(`scan:${projectId}:data`, {
          status: "completed",
          progress: 100,
          completedAt: new Date().toISOString(),
        });

        // Store sample schema data
        await kv.set(`data:${projectId}:schema`, {
          projectId,
          tables: [
            { name: "users", columns: ["id", "email", "created_at"] },
            { name: "projects", columns: ["id", "name", "user_id"] },
          ],
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.log(`Error during Data scan: ${error}`);
        await kv.set(`scan:${projectId}:data`, {
          status: "failed",
          progress: 0,
          error: String(error),
          failedAt: new Date().toISOString(),
        });
      }
    }, 100);

    return c.json({ success: true, message: "Data scan started" });
  } catch (error) {
    console.log(`Error starting Data scan: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Start all scans for a project
// Start all scans (IDOR: ownership check)
app.post("/scans/:projectId/all", async (c) => {
  try {
    const projectId = c.req.param("projectId");
    const own = await requireProjectOwner(c, projectId);
    if (!own.ok) {
      return c.json(
        {
          success: false,
          error: own.status === 404 ? "Project not found" : "Forbidden",
        },
        own.status,
      );
    }
    const project = own.project;

    const results = {
      appflow: false,
      blueprint: false,
      data: false,
    };

    // Start AppFlow scan if GitHub is configured
    if (project.github_repo) {
      const appflowUrl = `${
        c.req.url.split("/scans/")[0]
      }/scans/${projectId}/appflow`;
      const appflowResponse = await fetch(appflowUrl, { method: "POST" });
      results.appflow = appflowResponse.ok;
    }

    // Start Blueprint scan if GitHub is configured
    if (project.github_repo) {
      const blueprintUrl = `${
        c.req.url.split("/scans/")[0]
      }/scans/${projectId}/blueprint`;
      const blueprintResponse = await fetch(blueprintUrl, { method: "POST" });
      results.blueprint = blueprintResponse.ok;
    }

    // Start Data scan if Supabase is configured
    if (project.supabase_project_id) {
      const dataUrl = `${
        c.req.url.split("/scans/")[0]
      }/scans/${projectId}/data`;
      const dataResponse = await fetch(dataUrl, { method: "POST" });
      results.data = dataResponse.ok;
    }

    return c.json({ success: true, data: results });
  } catch (error) {
    console.log(`Error starting all scans: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

Deno.serve(app.fetch);
