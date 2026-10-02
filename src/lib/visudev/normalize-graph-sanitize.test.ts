/**
 * Metadata allowlist tests for SoftwareGraph sanitization (RVP-9 markers).
 */
import { describe, expect, it } from "vitest";
import { sanitizeMetadata, sanitizeNode } from "./normalize-graph-sanitize.js";

describe("sanitizeMetadata", () => {
  it("preserves RVP-9 infrastructure markers", () => {
    const metadata = sanitizeMetadata({
      infrastructure: true,
      source: "docker-compose",
      ports: "3000:3000",
      networks: "frontend",
      runtimeObserved: true,
      deploymentUnitId: "deploy:web",
      env: "prod",
      secretToken: "nope",
    });
    expect(metadata.infrastructure).toBe(true);
    expect(metadata.source).toBe("docker-compose");
    expect(metadata.ports).toBe("3000:3000");
    expect(metadata.networks).toBe("frontend");
    expect(metadata.runtimeObserved).toBe(true);
    expect(metadata.deploymentUnitId).toBe("deploy:web");
    expect(metadata.env).toBe("prod");
    expect(metadata.secretToken).toBeUndefined();
  });

  it("keeps infrastructure flag on sanitized service nodes", () => {
    const node = sanitizeNode({
      id: "service:web",
      kind: "service",
      label: "Web App",
      metadata: { infrastructure: true, framework: "Next.js 14" },
    });
    expect(node?.metadata.infrastructure).toBe(true);
  });
});
