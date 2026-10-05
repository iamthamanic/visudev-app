/**
 * Evidence-backed DataLineage builder across UI / SoftwareGraph / DataGraph (PR-21).
 * Name-only joins are forbidden; missing hops truncate paths honestly.
 * Location: shared/scan-detector/application/build-data-lineage.ts
 */

import type {
  DataLineageGraph,
  DataLineagePath,
  LineageEntityRef,
  LineageHop,
  LineageHopEvidence,
} from "../../data-lineage.types.js";
import type { DataGraph } from "../../data-graph.types.js";
import type {
  SoftwareGraph,
  SoftwareGraphEdge,
  SoftwareGraphNode,
} from "../../software-graph.types.js";
import type { UiInteractionGraph, UiTransition } from "../../ui-interaction-graph.types.js";
import { coerceKnowledgeStatus, type KnowledgeStatus } from "../epistemic.js";
import type { ScanEvidence, ScanFact } from "../types.js";

export interface BuildDataLineageInput {
  projectId: string;
  analyzedAt: string;
  software: SoftwareGraph;
  ui?: UiInteractionGraph | null;
  data?: DataGraph | null;
  /** Optional scan facts/evidence used for UI→endpoint joins (never name-only). */
  scan?: {
    facts?: readonly ScanFact[];
    evidence?: readonly ScanEvidence[];
  } | null;
}

function hopEvidence(
  evidenceId: string,
  sourceIr: LineageHopEvidence["sourceIr"],
  kind: string,
  extras?: Partial<LineageHopEvidence>,
): LineageHopEvidence {
  return {
    evidenceId,
    sourceIr,
    kind,
    ...extras,
  };
}

function makeHop(
  from: LineageEntityRef,
  to: LineageEntityRef,
  joinRuleId: string,
  knowledgeStatus: KnowledgeStatus,
  confidence: number,
  evidence: LineageHopEvidence[],
): LineageHop {
  return { from, to, joinRuleId, knowledgeStatus, confidence, evidence };
}

function nodeRef(
  layer: LineageEntityRef["layer"],
  node: Pick<SoftwareGraphNode, "id" | "label">,
): LineageEntityRef {
  return { layer, entityId: node.id, label: node.label };
}

function edgeEvidence(edge: SoftwareGraphEdge, graph: SoftwareGraph): LineageHopEvidence[] {
  const linked = (graph.evidence || []).filter((item) => item.edgeId === edge.id);
  const out: LineageHopEvidence[] = linked.map((item) =>
    hopEvidence(item.id, "software-graph", item.kind || "graph-edge", {
      summary: item.excerpt,
      filePath: item.filePath,
      line: item.line,
    }),
  );
  const factId = edge.metadata?.evidenceFactId;
  if (typeof factId === "string" && factId) {
    out.push(hopEvidence(factId, "scan", "edge-evidence-fact"));
  }
  return out;
}

function dominantStatus(statuses: KnowledgeStatus[]): KnowledgeStatus {
  if (statuses.includes("CONFLICTED")) return "CONFLICTED";
  if (statuses.includes("VERIFIED")) return "VERIFIED";
  if (statuses.includes("SUPPORTED")) return "SUPPORTED";
  if (statuses.includes("INTERPRETED")) return "INTERPRETED";
  return "UNKNOWN";
}

/**
 * UI transition → endpoint only when a scan fact binds both via subject/object or attributes.
 * Never joins on file path / label alone.
 */
function findEndpointForTransition(
  transition: UiTransition,
  software: SoftwareGraph,
  facts: readonly ScanFact[],
): { node: SoftwareGraphNode; evidence: LineageHopEvidence[]; status: KnowledgeStatus } | null {
  const routes = software.nodes.filter((node) => node.kind === "route");
  for (const fact of facts) {
    const attrs = fact.attributes || {};
    const subjectIsTransition = fact.subjectId === transition.id;
    const objectIsTransition = fact.objectId === transition.id;
    const attrTransition =
      String(attrs.transitionId || attrs.uiTransitionId || "") === transition.id;
    if (!subjectIsTransition && !objectIsTransition && !attrTransition) continue;

    const routeId =
      (subjectIsTransition ? fact.objectId : undefined) ||
      (objectIsTransition ? fact.subjectId : undefined) ||
      String(attrs.routeId || attrs.endpointId || "");
    const route = routes.find(
      (node) => node.id === routeId || String(node.metadata?.routeId || "") === routeId,
    );
    if (!route) continue;

    return {
      node: route,
      evidence: [
        hopEvidence(fact.id, "scan", fact.kind || "ui-endpoint-join", {
          summary: "Scan fact binds UI transition to endpoint",
        }),
        ...fact.evidenceIds.map((id) => hopEvidence(id, "scan", "scan-evidence")),
      ],
      status: coerceKnowledgeStatus(fact.status),
    };
  }
  return null;
}

function nextModuleHop(
  fromId: string,
  software: SoftwareGraph,
): { node: SoftwareGraphNode; edge: SoftwareGraphEdge } | null {
  const edges = (software.edges || []).filter(
    (edge) =>
      edge.sourceId === fromId &&
      (edge.kind === "calls" || edge.kind === "implements" || edge.kind === "contains"),
  );
  for (const edge of edges) {
    const evidence = edgeEvidence(edge, software);
    if (evidence.length === 0) continue;
    const target = software.nodes.find((node) => node.id === edge.targetId);
    if (!target) continue;
    if (!["service", "module", "repository", "application"].includes(target.kind)) continue;
    return { node: target, edge };
  }
  return null;
}

function nextDataHop(
  fromId: string,
  software: SoftwareGraph,
  data: DataGraph | null | undefined,
): {
  entity: LineageEntityRef;
  evidence: LineageHopEvidence[];
  status: KnowledgeStatus;
} | null {
  const edges = (software.edges || []).filter(
    (edge) => edge.sourceId === fromId && edge.kind === "data",
  );
  for (const edge of edges) {
    const evidence = edgeEvidence(edge, software);
    if (evidence.length === 0) continue;
    const tableNode = software.nodes.find((node) => node.id === edge.targetId);
    if (!tableNode || tableNode.kind !== "table") continue;

    const factId =
      typeof edge.metadata?.evidenceFactId === "string" ? edge.metadata.evidenceFactId : null;
    // DataGraph join only via shared evidence id — never by table label/name alone.
    const dataTable =
      factId && data ? data.tables.find((table) => table.evidenceIds.includes(factId)) : undefined;

    if (dataTable) {
      return {
        entity: {
          layer: "data-entity",
          entityId: dataTable.id,
          label: dataTable.label,
        },
        evidence: [
          ...evidence,
          ...dataTable.evidenceIds.map((id) => hopEvidence(id, "data-graph", "data-table")),
        ],
        status: dominantStatus(["SUPPORTED", coerceKnowledgeStatus(dataTable.status)]),
      };
    }

    // Evidenced SoftwareGraph table hop remains valid without a DataGraph name match.
    return {
      entity: nodeRef("data-entity", tableNode),
      evidence,
      status: "SUPPORTED",
    };
  }
  return null;
}

function finalizePath(
  seedId: string,
  hops: LineageHop[],
  truncationReason?: string,
): DataLineagePath {
  const layers = new Set(hops.flatMap((hop) => [hop.from.layer, hop.to.layer]));
  const hasEndpoint = layers.has("endpoint");
  const hasData = layers.has("data-entity");
  let status: DataLineagePath["status"] = "unresolved";
  if (hops.length === 0) status = "unresolved";
  else if (!truncationReason && hasEndpoint && hasData) status = "complete";
  else status = "partial";

  return {
    id: `lineage:${seedId}`,
    status,
    hops,
    terminalHopIndex: Math.max(0, hops.length - 1),
    truncationReason,
  };
}

function appendModuleAndData(
  seedId: string,
  hops: LineageHop[],
  startId: string,
  startRef: LineageEntityRef,
  software: SoftwareGraph,
  data: DataGraph | null | undefined,
): DataLineagePath {
  const moduleHop = nextModuleHop(startId, software);
  let cursorId = startId;
  let fromRef = startRef;
  if (moduleHop) {
    hops.push(
      makeHop(
        startRef,
        nodeRef("service-module", moduleHop.node),
        `graph-edge:${moduleHop.edge.kind}`,
        "SUPPORTED",
        0.75,
        edgeEvidence(moduleHop.edge, software),
      ),
    );
    cursorId = moduleHop.node.id;
    fromRef = nodeRef("service-module", moduleHop.node);
  }

  const dataHop = nextDataHop(cursorId, software, data) || nextDataHop(startId, software, data);
  if (!dataHop) {
    return finalizePath(seedId, hops, "no-evidenced-data-hop");
  }
  hops.push(
    makeHop(fromRef, dataHop.entity, "graph-edge:data", dataHop.status, 0.8, dataHop.evidence),
  );
  return finalizePath(seedId, hops);
}

export function buildDataLineage(input: BuildDataLineageInput): DataLineageGraph {
  const software = input.software;
  const facts = input.scan?.facts || [];
  const paths: DataLineagePath[] = [];

  const transitions = input.ui?.transitions || [];
  if (transitions.length > 0) {
    for (const transition of transitions) {
      const hops: LineageHop[] = [];
      const surface = input.ui?.surfaces.find((item) => item.id === transition.fromSurfaceId);
      const interactionRef: LineageEntityRef = {
        layer: "ui-interaction",
        entityId: transition.id,
        label: transition.kind,
      };
      if (surface) {
        hops.push(
          makeHop(
            {
              layer: "ui-surface",
              entityId: surface.id,
              label: surface.label,
            },
            interactionRef,
            "ui-surface-transition",
            coerceKnowledgeStatus(transition.status),
            transition.confidence,
            (transition.evidenceIds || []).map((id) => hopEvidence(id, "ui", "ui-transition")),
          ),
        );
      }

      const endpoint = findEndpointForTransition(transition, software, facts);
      if (!endpoint) {
        paths.push(finalizePath(transition.id, hops, "no-evidenced-endpoint-for-interaction"));
        continue;
      }
      hops.push(
        makeHop(
          interactionRef,
          nodeRef("endpoint", endpoint.node),
          "scan-fact-ui-endpoint",
          endpoint.status,
          0.7,
          endpoint.evidence,
        ),
      );
      paths.push(
        appendModuleAndData(
          transition.id,
          hops,
          endpoint.node.id,
          nodeRef("endpoint", endpoint.node),
          software,
          input.data,
        ),
      );
    }
  } else {
    for (const route of software.nodes.filter((node) => node.kind === "route")) {
      paths.push(
        appendModuleAndData(
          route.id,
          [],
          route.id,
          nodeRef("endpoint", route),
          software,
          input.data,
        ),
      );
    }
  }

  return {
    version: 1,
    projectId: input.projectId,
    analyzedAt: input.analyzedAt,
    paths,
    stats: {
      pathCount: paths.length,
      completeCount: paths.filter((path) => path.status === "complete").length,
      partialCount: paths.filter((path) => path.status === "partial").length,
      unresolvedCount: paths.filter((path) => path.status === "unresolved").length,
    },
  };
}
