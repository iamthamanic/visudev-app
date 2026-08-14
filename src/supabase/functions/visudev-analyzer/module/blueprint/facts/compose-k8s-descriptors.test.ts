/**
 * Tests for Compose/K8s descriptor parsing (AUF-3).
 */

import { assertEquals } from "std/assert";
import {
  isComposeDescriptorPath,
  isK8sDescriptorPath,
  MAX_SERVICES_PER_FILE,
  parseComposeDeployServices,
  parseDeployDescriptors,
  parseK8sDeployServices,
} from "./compose-k8s-descriptors.ts";

const COMPOSE_FIXTURE = `
name: shop
services:
  api:
    image: node:20-alpine
    ports:
      - "3000:3000"
    networks:
      - frontend
      - backend
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
  db:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    networks:
      - backend
  redis:
    image: redis:7-alpine
    networks:
      - backend
`;

Deno.test("parseComposeDeployServices reads services, ports, networks, depends_on", () => {
  const services = parseComposeDeployServices(
    "docker-compose.yml",
    COMPOSE_FIXTURE,
  );
  assertEquals(services.map((s) => s.name), ["api", "db", "redis"]);
  const api = services[0];
  assertEquals(api?.ports, ["3000:3000"]);
  assertEquals(api?.networks, ["frontend", "backend"]);
  assertEquals(api?.dependsOn, ["db", "redis"]);
  assertEquals(api?.env, "shop");
  assertEquals(api?.region, undefined);
  assertEquals(api?.source, "docker-compose");
});

Deno.test("parseComposeDeployServices reads inline flow sequences and host-bound ports", () => {
  const services = parseComposeDeployServices(
    "docker-compose.yml",
    `services:
  api:
    image: nginx
    ports: ["127.0.0.1:8080:80", "3000:3000"]
    networks: [frontend, backend]
    depends_on: [db, redis]
  db:
    image: postgres
  redis:
    image: redis
`,
  );
  const api = services[0];
  assertEquals(api?.ports, ["8080:80", "3000:3000"]);
  assertEquals(api?.networks, ["frontend", "backend"]);
  assertEquals(api?.dependsOn, ["db", "redis"]);
});

Deno.test("parseComposeDeployServices uses filename suffix as env", () => {
  const services = parseComposeDeployServices(
    "docker-compose.prod.yml",
    "services:\n  web:\n    image: nginx\n    ports:\n      - 80\n",
  );
  assertEquals(services[0]?.env, "prod");
  assertEquals(services[0]?.ports, ["80"]);
});

Deno.test("parseComposeDeployServices does not invent a region", () => {
  const services = parseComposeDeployServices(
    "docker-compose.yml",
    "services:\n  web:\n    image: nginx\n    environment:\n      REGION: eu-central-1\n",
  );
  assertEquals(services[0]?.region, undefined);
  assertEquals(services[0]?.env, undefined);
});

Deno.test("parseComposeDeployServices reads region only from allowlisted labels", () => {
  const services = parseComposeDeployServices(
    "docker-compose.yml",
    `services:
  web:
    image: nginx
    labels:
      topology.kubernetes.io/region: eu-central-1
`,
  );
  assertEquals(services[0]?.region, "eu-central-1");
});

Deno.test("parseComposeDeployServices skips helm-like templates", () => {
  const services = parseComposeDeployServices(
    "docker-compose.yml",
    "services:\n  web:\n    image: {{ .Values.image }}\n",
  );
  assertEquals(services.length, 0);
});

Deno.test("parseK8sDeployServices reads deployment name, namespace, ports, region", () => {
  const services = parseK8sDeployServices(
    "k8s/web-deployment.yaml",
    `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: prod
  labels:
    topology.kubernetes.io/region: eu-west-1
spec:
  template:
    spec:
      containers:
        - name: web
          ports:
            - containerPort: 8080
`,
  );
  assertEquals(services.length, 1);
  assertEquals(services[0]?.name, "web");
  assertEquals(services[0]?.env, "prod");
  assertEquals(services[0]?.region, "eu-west-1");
  assertEquals(services[0]?.ports, ["8080"]);
  assertEquals(services[0]?.source, "kubernetes");
});

Deno.test("parseK8sDeployServices skips helm templates and unknown kinds", () => {
  assertEquals(
    parseK8sDeployServices(
      "k8s/deployment.yaml",
      'kind: Deployment\nmetadata:\n  name: {{ include "name" . }}\n',
    ).length,
    0,
  );
  assertEquals(
    parseK8sDeployServices(
      "k8s/configmap.yaml",
      "kind: ConfigMap\nmetadata:\n  name: cfg\n",
    ).length,
    0,
  );
});

Deno.test("descriptor path helpers", () => {
  assertEquals(isComposeDescriptorPath("docker-compose.yml"), true);
  assertEquals(isComposeDescriptorPath("compose.yaml"), true);
  assertEquals(isK8sDescriptorPath("k8s/web.yaml"), true);
  assertEquals(isK8sDescriptorPath("manifests/deployment.yaml"), true);
  assertEquals(isK8sDescriptorPath(".github/workflows/ci.yml"), false);
  assertEquals(isK8sDescriptorPath("docker-compose.yml"), false);
});

Deno.test("parseDeployDescriptors ignores CI yaml", () => {
  assertEquals(
    parseDeployDescriptors(
      ".github/workflows/ci.yml",
      "kind: Deployment\nmetadata:\n  name: web\n",
    ).length,
    0,
  );
});

function captureWarns(run: () => void): string[] {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(" "));
  };
  try {
    run();
  } finally {
    console.warn = original;
  }
  return warnings;
}

Deno.test("parseComposeDeployServices warns when the service cap is hit", () => {
  const extra = 3;
  const lines = ["services:"];
  for (let i = 0; i < MAX_SERVICES_PER_FILE + extra; i += 1) {
    lines.push(`  svc${i}:`, "    image: nginx");
  }
  let services: ReturnType<typeof parseComposeDeployServices> = [];
  const warnings = captureWarns(() => {
    services = parseComposeDeployServices(
      "docker-compose.yml",
      lines.join("\n"),
    );
  });
  assertEquals(services.length, MAX_SERVICES_PER_FILE);
  assertEquals(
    warnings.some((line) =>
      line.includes("truncated") && line.includes(`dropped ${extra}`)
    ),
    true,
  );
});

Deno.test("parseK8sDeployServices warns when the resource cap is hit", () => {
  const extra = 2;
  const docs: string[] = [];
  for (let i = 0; i < MAX_SERVICES_PER_FILE + extra; i += 1) {
    docs.push(
      `kind: Deployment\nmetadata:\n  name: web${i}\n  namespace: prod`,
    );
  }
  let services: ReturnType<typeof parseK8sDeployServices> = [];
  const warnings = captureWarns(() => {
    services = parseK8sDeployServices(
      "k8s/all.yaml",
      docs.join("\n---\n"),
    );
  });
  assertEquals(services.length, MAX_SERVICES_PER_FILE);
  assertEquals(
    warnings.some((line) =>
      line.includes("truncated") && line.includes(`dropped ${extra}`)
    ),
    true,
  );
});
