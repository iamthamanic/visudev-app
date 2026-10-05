/**
 * VisuDEV Edge Function: Blueprint
 *
 * @version 1.0.0
 * @created 2025-11-06T12:00:00.000Z
 * @updated 2025-11-06T12:00:00.000Z
 *
 * @description Architecture blueprint and layer visualization API.
 * IDOR: All routes are project-scoped; middleware enforces project ownership (JWT must match project.ownerId).
 */

import type { Context } from "hono";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createClient } from "@jsr/supabase__supabase-js";
import { z } from "zod";

const MAX_BLUEPRINT_BODY_BYTES = 500_000;

const blueprintPutBodySchema = z
  .record(z.unknown())
  .refine(
    (obj) =>
      new TextEncoder().encode(JSON.stringify(obj)).length <=
        MAX_BLUEPRINT_BODY_BYTES,
    {
      message:
        `Blueprint body must be at most ${MAX_BLUEPRINT_BODY_BYTES} bytes`,
    },
  );

// KV Store Implementation (inline for Dashboard compatibility)
const kvClient = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

const kvSet = async (key: string, value: unknown): Promise<void> => {
  const supabase = kvClient();
  const { error } = await supabase.from("kv_store_edf036ef").upsert({
    key,
    value,
  });
  if (error) throw new Error(error.message);
};

const kvGet = async (key: string): Promise<unknown> => {
  const supabase = kvClient();
  const { data, error } = await supabase
    .from("kv_store_edf036ef")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.value;
};

const kvDel = async (key: string): Promise<void> => {
  const supabase = kvClient();
  const { error } = await supabase.from("kv_store_edf036ef").delete().eq(
    "key",
    key,
  );
  if (error) throw new Error(error.message);
};

const VISUDEV_GUEST_OWNER_ID = "visudev-local-guest";

function isSupabaseLocalDockerStack(): boolean {
  const dbUrl = Deno.env.get("SUPABASE_DB_URL") ?? "";
  if (dbUrl.includes("@db:") || dbUrl.includes("@db/")) return true;
  return Boolean(Deno.env.get("SUPABASE_INTERNAL_HOST_PORT"));
}

// API Implementation
const app = new Hono().basePath("/visudev-blueprint");

app.use("*", logger(console.log));
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-VisuDev-Guest",
      "X-VisuDev-Guest-Token",
    ],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

async function getUserIdOptional(c: Context): Promise<string | null> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (anonKey && token === anonKey) return null;
  try {
    const supabase = kvClient();
    const { data } = await supabase.auth.getUser(token);
    return data?.user?.id ?? null;
  } catch (e) {
    console.warn("[getUserIdOptional] auth.getUser failed", {
      message: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

async function resolveRequestUserId(c: Context): Promise<string | null> {
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

async function getProjectOwnerId(projectId: string): Promise<string | null> {
  const project = await kvGet(`project:${projectId}`) as
    | { ownerId?: string }
    | null
    | undefined;
  return project?.ownerId ?? null;
}

app.use("*", async (c, next) => {
  const projectId = c.req.param("projectId");
  if (!projectId) return next();
  const ownerId = await getProjectOwnerId(projectId);
  const userId = await resolveRequestUserId(c);
  if (userId === null) {
    return c.json({ success: false, error: "Forbidden" }, 403);
  }
  if (ownerId == null || ownerId === "" || userId !== ownerId) {
    return c.json({ success: false, error: "Forbidden" }, 403);
  }
  return next();
});

// Get blueprint for project
app.get("/:projectId", async (c) => {
  try {
    const projectId = c.req.param("projectId");
    const blueprint = await kvGet(`blueprint:${projectId}`);
    return c.json({ success: true, data: blueprint || {} });
  } catch (error) {
    console.log(`Error fetching blueprint: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Update blueprint (input validated with Zod to avoid invalid payloads and size abuse)
app.put("/:projectId", async (c) => {
  try {
    const projectId = c.req.param("projectId");
    const raw = await c.req.json();
    const parseResult = blueprintPutBodySchema.safeParse(raw);
    if (!parseResult.success) {
      return c.json(
        { success: false, error: parseResult.error.message },
        400,
      );
    }
    const body = parseResult.data;
    const blueprint = {
      ...body,
      projectId,
      updatedAt: new Date().toISOString(),
    };
    await kvSet(`blueprint:${projectId}`, blueprint);
    return c.json({ success: true, data: blueprint });
  } catch (error) {
    console.log(`Error updating blueprint: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Delete blueprint
app.delete("/:projectId", async (c) => {
  try {
    const projectId = c.req.param("projectId");
    await kvDel(`blueprint:${projectId}`);
    return c.json({ success: true });
  } catch (error) {
    console.log(`Error deleting blueprint: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

Deno.serve(app.fetch);
