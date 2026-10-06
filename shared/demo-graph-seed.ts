/**
 * HR-tool demo SoftwareGraph fixture (browo/hr-tool Zielbild baseline).
 * Location: shared/demo-graph-seed.ts
 */

import type { SoftwareGraph } from "./software-graph.types.js";

const LAYER_LABELS = [
  "Experience Layer",
  "Application Layer",
  "Domain Layer",
  "Integration Layer",
  "Persistence Layer",
  "Processing Layer",
  "Platform Layer",
] as const;

const DOMAIN_MODULES = [
  "People",
  "Time",
  "Leave",
  "Documents",
  "Payroll",
  "Workflows",
  "Analytics",
] as const;

function node(
  id: string,
  kind: SoftwareGraph["nodes"][0]["kind"],
  label: string,
  extra: Partial<SoftwareGraph["nodes"][0]> = {},
) {
  return { id, kind, label, metadata: {}, ...extra };
}

function edge(
  id: string,
  kind: SoftwareGraph["edges"][0]["kind"],
  sourceId: string,
  targetId: string,
) {
  return { id, kind, sourceId, targetId, metadata: {} };
}

/**
 * Builds a sagadrive-friendly HR-tool reference graph (matches Zielbild fixtures).
 */
export function buildHrToolDemoGraph(projectId: string): SoftwareGraph {
  const analyzedAt = new Date().toISOString();
  const nodes = [
    node("org:hr", "organization", projectId),
    node("app:hr", "application", "hr-tool", { scopeId: "org:hr" }),
    ...LAYER_LABELS.map((label, index) =>
      node(`layer:${index}`, "layer", label, { scopeId: "app:hr" }),
    ),
    ...DOMAIN_MODULES.map((label, index) =>
      node(`domain:${index}`, "domain", label, { scopeId: "layer:2" }),
    ),
    node("module:leave-uc", "module", "CreateLeaveRequest", {
      filePath: "src/application/create-leave-request.ts",
    }),
    node("module:leave-repo", "module", "LeaveRepository", {
      filePath: "src/domain/leave-repository.ts",
      metadata: { durationMs: 55 },
    }),
    // Corroborate additional product areas (PU-07 Atlas clusters) via domain+module pairs.
    node("module:people-repo", "module", "PeopleRepository", {
      filePath: "src/domain/people-repository.ts",
    }),
    node("module:payroll-repo", "module", "PayrollRepository", {
      filePath: "src/domain/payroll-repository.ts",
    }),
    node("module:documents-repo", "module", "DocumentsRepository", {
      filePath: "src/domain/documents-repository.ts",
    }),
    node("route:leave", "route", "POST /api/leave-requests", {
      filePath: "src/routes/leave.ts",
      line: 12,
      metadata: {
        routeId: "leave",
        executionStatus: "running",
        traceId: "tr-7f3a2b1c",
        durationMs: 35,
      },
    }),
    node("file:form", "file", "LeaveRequestForm", {
      filePath: "src/ui/LeaveRequestForm.tsx",
      metadata: { runtime: "browser", type: "Use Case" },
    }),
    node("file:uc", "file", "CreateLeaveRequest", {
      filePath: "src/application/create-leave-request.ts",
      metadata: { runtime: "server", type: "Use Case", durationMs: 68 },
    }),
    node("file:controller", "file", "LeaveController", {
      filePath: "src/api/leave-controller.ts",
      metadata: { type: "Controller", durationMs: 42 },
    }),
    node("service:auth", "service", "AuthService", {
      metadata: { type: "Service", durationMs: 31 },
    }),
    node("service:validation", "service", "ValidationService", {
      metadata: { type: "Service", durationMs: 24 },
    }),
    node("service:policy", "service", "LeavePolicy", {
      metadata: { type: "Policy", durationMs: 18 },
    }),
    node("service:email", "external", "EmailService", { metadata: { type: "Externer Service" } }),
    node("service:worker", "service", "NotificationWorker", {
      metadata: { type: "Worker", durationMs: 22 },
    }),
    node("service:web", "service", "Web App", {
      metadata: {
        framework: "Next.js 14",
        port: 3000,
        tier: "web",
        env: "prod",
        region: "eu-central-1",
        infrastructure: true,
      },
    }),
    node("service:api", "service", "API Service", {
      metadata: {
        framework: "NestJS",
        port: 4000,
        tier: "api",
        env: "prod",
        region: "eu-central-1",
        infrastructure: true,
      },
    }),
    node("service:worker-infra", "service", "Worker", {
      metadata: {
        framework: "BullMQ",
        port: 4001,
        tier: "worker",
        env: "prod",
        region: "eu-central-1",
        infrastructure: true,
      },
    }),
    node("service:auth-infra", "service", "Auth Service", {
      metadata: {
        framework: "Node.js 20",
        port: 4002,
        tier: "auth",
        env: "prod",
        region: "eu-central-1",
        infrastructure: true,
      },
    }),
    node("runtime:lb", "runtime", "LOAD BALANCER / GATEWAY", {
      metadata: { technology: "NGINX" },
    }),
    node("runtime:internet", "runtime", "Internet", { metadata: { tier: "edge" } }),
    node("table:pg", "table", "PostgreSQL", {
      filePath: "docker-compose.yml",
      metadata: { version: "15", port: 5432, durationMs: 89, source: "docker-compose" },
    }),
    node("table:redis", "table", "Redis", {
      filePath: "docker-compose.yml",
      metadata: { version: "7", port: 6379, source: "docker-compose" },
    }),
    node("table:storage", "table", "STORAGE", {
      filePath: "infra/storage.md",
      metadata: { kind: "S3 Compatible" },
    }),
    node("external:stripe", "external", "Payment API (Stripe)", {}),
    node("external:sso", "external", "SSO (OIDC)", {}),
    node("external:hr-data", "external", "HR Datenanbieter", {}),
    node("external:monitor", "external", "Prometheus", { metadata: { tier: "monitoring" } }),
    node("external:grafana", "external", "Grafana", { metadata: { tier: "monitoring" } }),
    node("external:loki", "external", "Loki", { metadata: { tier: "monitoring" } }),
    node("external:alertmanager", "external", "Alertmanager", { metadata: { tier: "monitoring" } }),
    node("runtime:main", "runtime", "runtime", { metadata: { runtimes: ["server", "browser"] } }),
  ];

  const edges = [
    edge("e-org-app", "contains", "org:hr", "app:hr"),
    ...LAYER_LABELS.map((_, index) =>
      edge(`e-app-layer-${index}`, "contains", "app:hr", `layer:${index}`),
    ),
    ...DOMAIN_MODULES.map((_, index) =>
      edge(`e-layer-domain-${index}`, "contains", "layer:2", `domain:${index}`),
    ),
    edge("e-domain-leave", "contains", "domain:2", "module:leave-uc"),
    edge("e-module-route", "contains", "module:leave-uc", "route:leave"),
    edge("e-form-uc", "calls", "file:form", "file:uc"),
    edge("e-uc-controller", "calls", "file:uc", "file:controller"),
    edge("e-uc-auth", "authenticates", "file:uc", "service:auth"),
    edge("e-uc-validation", "validates", "file:uc", "service:validation"),
    edge("e-uc-policy", "calls", "file:uc", "service:policy"),
    edge("e-uc-repo", "calls", "file:uc", "module:leave-repo"),
    edge("e-repo-pg", "data", "module:leave-repo", "table:pg"),
    edge("e-uc-email", "external-dependency", "file:uc", "service:email"),
    edge("e-uc-worker", "event", "file:uc", "service:worker"),
    edge("e-internet-lb", "api", "runtime:internet", "runtime:lb"),
    edge("e-lb-web", "api", "runtime:lb", "service:web"),
    edge("e-lb-api", "api", "runtime:lb", "service:api"),
    edge("e-api-pg", "data", "service:api", "table:pg"),
    edge("e-api-redis", "data", "service:api", "table:redis"),
    edge("e-api-storage", "data", "service:api", "table:storage"),
    edge("e-worker-redis", "data", "service:worker-infra", "table:redis"),
    edge("e-api-stripe", "external-dependency", "service:api", "external:stripe"),
    edge("e-auth-sso", "external-dependency", "service:auth-infra", "external:sso"),
    edge("e-api-monitor", "references", "service:api", "external:monitor"),
    edge("e-runtime-uc", "contains", "runtime:main", "file:uc"),
    edge("e-layer-web", "contains", "layer:0", "service:web"),
    edge("e-layer-api", "contains", "layer:1", "service:api"),
    edge("e-layer-pg", "contains", "layer:4", "table:pg"),
  ];

  return {
    version: 1,
    projectId,
    analyzedAt,
    scopes: [
      { level: "organization", id: "org:hr", label: projectId },
      { level: "application", id: "app:hr", label: "hr-tool", parentId: "org:hr" },
    ],
    nodes,
    edges,
    evidence: [
      {
        id: "ev-payload-req",
        factId: "fact-payload-req",
        kind: "payload-request",
        filePath: "src/routes/leave.ts",
        line: 12,
        excerpt:
          '{\n  "resourceRef": "demo-resource-001",\n  "type": "ANNUAL",\n  "reason": "demo",\n  "startDate": "2026-08-01",\n  "endDate": "2026-08-14"\n}',
        nodeId: "route:leave",
      },
      {
        id: "ev-payload-res",
        factId: "fact-payload-res",
        kind: "payload-response",
        filePath: "src/routes/leave.ts",
        line: 12,
        excerpt:
          '{\n  "status": "accepted",\n  "id": "lr_demo_001",\n  "message": "Leave request queued",\n  "submittedAt": "2026-07-14T10:32:01Z"\n}',
        nodeId: "route:leave",
      },
      {
        id: "ev-payload-req-uc",
        factId: "fact-payload-req-uc",
        kind: "payload-request",
        filePath: "src/application/create-leave-request.ts",
        line: 42,
        excerpt:
          '{"resourceRef":"demo-resource-001","type":"ANNUAL","startDate":"2026-08-01","endDate":"2026-08-14"}',
        nodeId: "file:uc",
      },
      {
        id: "ev-payload-res-ctrl",
        factId: "fact-payload-res-ctrl",
        kind: "payload-response",
        filePath: "src/api/leave-controller.ts",
        line: 28,
        excerpt: '{"id":"lr_demo_001","status":"pending","createdAt":"2026-07-14T10:32:01Z"}',
        nodeId: "file:controller",
      },
      {
        id: "ev-headers",
        factId: "fact-headers",
        kind: "http-header",
        filePath: "src/routes/leave.ts",
        line: 12,
        excerpt:
          '{"authorization":"Bearer ***","content-type":"application/json","x-request-id":"req-demo-001"}',
        nodeId: "route:leave",
      },
      {
        id: "ev-headers-ctrl",
        factId: "fact-headers-ctrl",
        kind: "http-header",
        filePath: "src/api/leave-controller.ts",
        line: 12,
        excerpt:
          '{"x-auth-present":"true","content-type":"application/json","x-request-id":"req-demo-001"}',
        nodeId: "file:controller",
      },
      {
        id: "ev-log",
        factId: "fact-log",
        kind: "log-line",
        filePath: "src/routes/leave.ts",
        line: 12,
        excerpt: "2026-07-14T10:32:01.010Z INFO POST /api/leave-requests accepted",
        nodeId: "route:leave",
      },
      {
        id: "ev-log-uc",
        factId: "fact-log-uc",
        kind: "log-line",
        filePath: "src/application/create-leave-request.ts",
        line: 55,
        excerpt: "2026-07-14T10:32:01.080Z INFO LeaveRequest persisted",
        nodeId: "file:uc",
      },
      {
        id: "ev-tag",
        factId: "fact-tag",
        kind: "trace-tag",
        filePath: "src/routes/leave.ts",
        line: 14,
        excerpt: "http.method=POST · http.status_code=200 · feature=leave",
        nodeId: "route:leave",
      },
      {
        id: "ev-auth",
        factId: "fact-auth",
        kind: "log-line",
        filePath: "src/services/auth-service.ts",
        line: 18,
        excerpt: "2026-07-14T10:32:01.040Z INFO Auth gate confirmed for demo session",
        nodeId: "service:auth",
      },
      {
        id: "ev-validation",
        factId: "fact-validation",
        kind: "payload-request",
        filePath: "src/services/validation-service.ts",
        line: 11,
        excerpt: '{"schema":"LeaveRequest","valid":true}',
        nodeId: "service:validation",
      },
      {
        id: "ev-repo",
        factId: "fact-repo",
        kind: "log-line",
        filePath: "src/domain/leave-repository.ts",
        line: 33,
        excerpt: "2026-07-14T10:32:01.090Z INFO INSERT leave_requests OK",
        nodeId: "module:leave-repo",
      },
      {
        id: "ev-pg",
        factId: "fact-pg",
        kind: "log-line",
        filePath: "db/leave_requests.sql",
        line: 4,
        excerpt: "2026-07-14T10:32:01.120Z INFO PostgreSQL commit 12ms",
        nodeId: "table:pg",
      },
      {
        id: "ev-worker",
        factId: "fact-worker",
        kind: "log-line",
        filePath: "src/workers/notification-worker.ts",
        line: 9,
        excerpt: "2026-07-14T10:32:01.150Z INFO enqueue notification leave.created",
        nodeId: "service:worker",
      },
    ],
    groups: [
      {
        id: "g-atlas-web",
        kind: "service",
        label: "WEB APP",
        nodeIds: ["service:web", "file:form"],
      },
      {
        id: "g-atlas-api",
        kind: "service",
        label: "API SERVICE",
        nodeIds: ["service:api", "file:uc", "file:controller"],
      },
      {
        id: "g-atlas-worker",
        kind: "service",
        label: "WORKER",
        nodeIds: ["service:worker-infra", "service:worker", "table:redis"],
      },
      {
        id: "g-atlas-data",
        kind: "table",
        label: "DATEN",
        nodeIds: ["table:pg"],
      },
      {
        id: "g-atlas-storage",
        kind: "table",
        label: "SPEICHER",
        nodeIds: ["table:storage"],
      },
      {
        id: "g-atlas-external",
        kind: "external",
        label: "EXTERN",
        nodeIds: ["external:stripe", "external:sso", "service:email"],
      },
      {
        id: "g-atlas-security",
        kind: "service",
        label: "SICHERHEIT",
        nodeIds: ["service:auth-infra", "service:auth"],
      },
      {
        id: "execution:leave:0",
        kind: "route",
        label: "LeaveRequest · Echtzeit-Trace",
        nodeIds: [
          "route:leave",
          "file:controller",
          "file:uc",
          "service:auth",
          "service:validation",
          "module:leave-repo",
          "table:pg",
          "service:worker",
        ],
      },
    ],
    metrics: [
      { id: "m-modules", name: "modules", value: 1248 },
      { id: "m-files", name: "files", value: 5732 },
      { id: "m-coverage", name: "coverage", value: 98 },
    ],
    condensed: false,
    limits: { maxNodes: 2500, maxEdges: 5000 },
    snapshots: [
      {
        id: "snap-1",
        label: "Init HR Domain",
        ref: "8a7c3d1",
        capturedAt: "2026-04-26T10:00:00.000Z",
        nodeIds: ["domain:0", "domain:2", "module:leave-uc"],
        commitSha: "8a7c3d1",
      },
      {
        id: "snap-2",
        label: "Payroll Integration",
        ref: "e9b3c42",
        capturedAt: "2026-05-06T14:32:00.000Z",
        nodeIds: ["domain:4", "module:leave-uc", "service:api", "table:pg"],
        commitSha: "e9b3c42",
      },
      {
        id: "snap-3",
        label: "Auth Hardening",
        ref: "f1a2b3c",
        capturedAt: "2026-05-12T09:15:00.000Z",
        nodeIds: ["service:auth", "service:auth-infra", "file:uc"],
        commitSha: "f1a2b3c",
      },
      {
        id: "snap-4",
        label: "Worker Queue",
        ref: "a4b5c6d",
        capturedAt: "2026-05-18T16:00:00.000Z",
        nodeIds: ["service:worker", "service:worker-infra", "table:redis"],
        commitSha: "a4b5c6d",
      },
      {
        id: "snap-5",
        label: "Monitoring Stack",
        ref: "c7d8e9f",
        capturedAt: "2026-05-24T11:00:00.000Z",
        nodeIds: ["external:monitor", "service:api", "runtime:lb"],
        commitSha: "c7d8e9f",
      },
    ],
  };
}
