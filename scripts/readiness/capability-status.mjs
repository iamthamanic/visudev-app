/**
 * Capability / runtime status helpers for Product Readiness harness (#375).
 * Optional missing capabilities must report UNAVAILABLE — never PASS.
 * Location: scripts/readiness/capability-status.mjs
 */

/** @typedef {"PASS" | "FAIL" | "UNAVAILABLE" | "SKIPPED"} CapabilityStatus */
/** @typedef {"required" | "optional"} CapabilityRequirement */

/**
 * Decide harness status for one capability.
 * @param {{
 *   requirement: CapabilityRequirement,
 *   available: boolean,
 *   passed?: boolean | null,
 *   gateMode?: "full" | "resolve",
 * }} input
 * @returns {CapabilityStatus}
 */
export function resolveCapabilityStatus(input) {
  const { requirement, available, passed = null, gateMode = "full" } = input;
  if (!available) {
    return "UNAVAILABLE";
  }
  if (gateMode === "resolve") {
    return "SKIPPED";
  }
  if (passed === true) return "PASS";
  if (passed === false) return "FAIL";
  return requirement === "required" ? "FAIL" : "UNAVAILABLE";
}

/**
 * Runtime exploration status (Safe Explore / secrets).
 * @param {{
 *   requirement: "required" | "optional" | "unsupported",
 *   secretsPresent: boolean,
 *   executed?: boolean,
 *   passed?: boolean | null,
 * }} input
 * @returns {CapabilityStatus}
 */
export function resolveRuntimeExplorationStatus(input) {
  const { requirement, secretsPresent, executed = false, passed = null } = input;
  if (requirement === "unsupported") return "SKIPPED";
  if (!secretsPresent || !executed) {
    // Missing optional runtime → UNAVAILABLE (never PASS)
    return "UNAVAILABLE";
  }
  if (passed === true) return "PASS";
  if (passed === false) return "FAIL";
  return requirement === "required" ? "FAIL" : "UNAVAILABLE";
}

/**
 * Aggregate project-level gate verdict from capability rows.
 * @param {Array<{ key: string, requirement: CapabilityRequirement, status: CapabilityStatus }>} rows
 * @param {{ sourceAvailable: boolean, sourceRequired: boolean }} source
 * @returns {{ verdict: "PASS" | "FAIL" | "UNAVAILABLE", reason: string }}
 */
export function aggregateProjectVerdict(rows, source) {
  if (!source.sourceAvailable) {
    if (source.sourceRequired) {
      return { verdict: "FAIL", reason: "required source unavailable" };
    }
    return { verdict: "UNAVAILABLE", reason: "optional local source unavailable" };
  }

  const failedRequired = rows.filter(
    (row) =>
      row.requirement === "required" && (row.status === "FAIL" || row.status === "UNAVAILABLE"),
  );
  if (failedRequired.length > 0) {
    return {
      verdict: "FAIL",
      reason: `required capabilities not satisfied: ${failedRequired.map((row) => row.key).join(", ")}`,
    };
  }

  const anyPass = rows.some((row) => row.status === "PASS");
  const onlySkippedOrUnavailable = rows.every(
    (row) => row.status === "SKIPPED" || row.status === "UNAVAILABLE" || row.status === "PASS",
  );
  if (!anyPass && onlySkippedOrUnavailable) {
    // Resolve-only matrix participation without claiming PASS
    return {
      verdict: "UNAVAILABLE",
      reason: "no capability executed (resolve mode or optional gaps)",
    };
  }
  return { verdict: "PASS", reason: "required capabilities passed" };
}

/**
 * Build capability rows for a project definition + availability context.
 * @param {{
 *   capabilities: Record<string, CapabilityRequirement>,
 *   runtimeExploration: "required" | "optional" | "unsupported",
 *   gate: { mode: "full" | "resolve" },
 * }} project
 * @param {{
 *   sourceAvailable: boolean,
 *   runtimeSecretsPresent?: boolean,
 *   runtimeExecuted?: boolean,
 *   capabilityResults?: Record<string, boolean | null>,
 * }} ctx
 */
export function buildCapabilityReport(project, ctx) {
  const capabilityResults = ctx.capabilityResults || {};
  const rows = Object.entries(project.capabilities).map(([key, requirement]) => {
    const available = ctx.sourceAvailable;
    const passed = Object.prototype.hasOwnProperty.call(capabilityResults, key)
      ? capabilityResults[key]
      : null;
    const status = resolveCapabilityStatus({
      requirement,
      available,
      passed,
      gateMode: project.gate.mode,
    });
    return { key, requirement, status };
  });

  const runtimeStatus = resolveRuntimeExplorationStatus({
    requirement: project.runtimeExploration,
    secretsPresent: Boolean(ctx.runtimeSecretsPresent),
    executed: Boolean(ctx.runtimeExecuted),
    passed: capabilityResults.appflowRuntime ?? null,
  });
  rows.push({
    key: "runtimeExploration",
    requirement:
      project.runtimeExploration === "unsupported" ? "optional" : project.runtimeExploration,
    status: runtimeStatus,
  });

  return rows;
}
