/**
 * Tier-1 infrastructure detectors (PR-14).
 * Location: …/facts/infra-tier1-descriptors.test.ts
 */

import { assertEquals } from "std/assert";
import { extractFactsFromFile } from "./fact-extractors.ts";
import {
  extractDockerfileFacts,
  extractEnvExampleInfraFacts,
  extractPackageJsonInfraFacts,
  isSafeEnvExamplePath,
  isTier1InfraDescriptorPath,
} from "./infra-tier1-descriptors.ts";

Deno.test("isTier1InfraDescriptorPath accepts Dockerfile / package.json / env examples", () => {
  assertEquals(isTier1InfraDescriptorPath("Dockerfile"), true);
  assertEquals(isTier1InfraDescriptorPath("apps/api/Dockerfile.prod"), true);
  assertEquals(isTier1InfraDescriptorPath("package.json"), true);
  assertEquals(isTier1InfraDescriptorPath(".env.example"), true);
  assertEquals(isTier1InfraDescriptorPath(".env.sample"), true);
  assertEquals(isSafeEnvExamplePath(".env"), false);
  assertEquals(isTier1InfraDescriptorPath("src/index.ts"), false);
});

Deno.test("extractDockerfileFacts emits deploy-service ports + postgres infra", () => {
  const content = `FROM node:20-alpine
WORKDIR /app
EXPOSE 3000 8080/tcp
CMD ["node","server.js"]
`;
  const facts = extractDockerfileFacts("Dockerfile", content);
  const deploy = facts.find((f) => f.kind === "deploy-service");
  assertEquals(deploy?.metadata?.source, "dockerfile");
  assertEquals(deploy?.metadata?.ports, "3000,8080");
  assertEquals(facts.some((f) => f.kind === "infra-service"), false);

  const dbDockerfile = `FROM postgres:16-alpine
EXPOSE 5432
`;
  const dbFacts = extractDockerfileFacts("db/Dockerfile", dbDockerfile);
  assertEquals(
    dbFacts.some((f) =>
      f.kind === "infra-service" && f.metadata?.service === "PostgreSQL"
    ),
    true,
  );
  assertEquals(
    dbFacts.some((f) =>
      f.kind === "deploy-service" && f.metadata?.source === "dockerfile"
    ),
    true,
  );
});

Deno.test("extractPackageJsonInfraFacts maps SDK deps without versions in snippets", () => {
  const content = JSON.stringify(
    {
      name: "demo",
      dependencies: {
        pg: "^8.0.0",
        ioredis: "^5.0.0",
        lodash: "^4.0.0",
      },
    },
    null,
    2,
  );
  const facts = extractPackageJsonInfraFacts("package.json", content);
  const services = facts.map((f) => f.metadata?.service).sort();
  assertEquals(services, ["PostgreSQL", "Redis"]);
  assertEquals(facts.every((f) => f.metadata?.source === "package-sdk"), true);
  assertEquals(facts.every((f) => !f.snippet.includes("8.0")), true);
});

Deno.test("extractEnvExampleInfraFacts uses names only and skips DATABASE_URL invention", () => {
  const content = `
# comment
DATABASE_URL=postgres://user:secret@host/db
REDIS_URL=redis://:hunter2@localhost:6379
POSTGRES_HOST=db
API_KEY=super-secret-token-value
`;
  const facts = extractEnvExampleInfraFacts(".env.example", content);
  const services = facts
    .filter((f) => f.kind === "infra-service")
    .map((f) => f.metadata?.service)
    .sort();
  assertEquals(services, ["PostgreSQL", "Redis"]);
  assertEquals(facts.every((f) => !f.snippet.includes("secret")), true);
  assertEquals(facts.every((f) => !f.snippet.includes("hunter2")), true);
  assertEquals(facts.every((f) => f.snippet.includes("***")), true);
});

Deno.test("extractFactsFromFile routes Tier-1 descriptors", () => {
  const pkg = extractFactsFromFile(
    "package.json",
    JSON.stringify({ dependencies: { mongodb: "6.0.0" } }),
  );
  assertEquals(pkg[0]?.metadata?.service, "MongoDB");

  const env = extractFactsFromFile(".env.example", "MYSQL_HOST=localhost\n");
  assertEquals(env[0]?.metadata?.service, "MySQL");
  assertEquals(env[0]?.metadata?.source, "env-name");
});

Deno.test("compose mysql image maps to MySQL infra-service", () => {
  const facts = extractFactsFromFile(
    "docker-compose.yml",
    `
services:
  db:
    image: mysql:8
`,
  );
  assertEquals(
    facts.some((f) =>
      f.kind === "infra-service" && f.metadata?.service === "MySQL"
    ),
    true,
  );
});
