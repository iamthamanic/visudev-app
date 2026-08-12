/**
 * Filename-stem domains for layer-first layouts (P0-14).
 * Location: local-engine/src/services/software-graph/_domain-from-filename.ts
 *
 * Pass 2 only: never overwrite domainSource "path". Requires a global index
 * built after all file contexts exist.
 */

import { detectLayer, UNASSIGNED_DOMAIN } from "./_heuristics.js";
import { createId, registerKnownId, stableUniqueId } from "./_ids.js";
import { addEdge, addNode, addScope, type GraphBuilderState } from "./_state.js";
import {
  createApplicationScope,
  createDomainScope,
  createLayerScope,
  createModuleScope,
} from "./_scopes.js";
import { extractFilenameStem } from "./_filename-stem.js";

export {
  extractFilenameStem,
  FILENAME_LAYER_SUFFIXES,
  GENERIC_FILENAME_STEMS,
  normalizeStem,
} from "./_filename-stem.js";

/** A filename stem becomes a domain only if it appears in this many layers. */
export const MIN_LAYERS_FOR_FILENAME_DOMAIN = 2;

/** And at least this many files share the stem. */
export const MIN_FILES_PER_FILENAME_DOMAIN = 2;

export interface FilenameDomainEntry {
  key: string;
  label: string;
  layers: Set<string>;
  filePaths: string[];
}

export interface FilenameDomainIndex {
  byKey: Map<string, FilenameDomainEntry>;
}

/** Known layers only — `unknown` must not inflate multi-layer candidacy. */
export function knownLayerCount(layers: ReadonlySet<string>): number {
  let count = 0;
  for (const layer of layers) {
    if (layer && layer !== "unknown") count += 1;
  }
  return count;
}

export function isFilenameDomainCandidate(
  entry: FilenameDomainEntry,
  minLayers: number = MIN_LAYERS_FOR_FILENAME_DOMAIN,
  minFiles: number = MIN_FILES_PER_FILENAME_DOMAIN,
): boolean {
  return knownLayerCount(entry.layers) >= minLayers && entry.filePaths.length >= minFiles;
}

function modeLabel(spellings: Map<string, number>): string {
  let best = "";
  let bestCount = -1;
  for (const [spelling, count] of spellings) {
    if (count > bestCount || (count === bestCount && spelling.localeCompare(best) < 0)) {
      best = spelling;
      bestCount = count;
    }
  }
  return best;
}

export function buildFilenameDomainIndex(
  files: readonly { path: string; layer: string }[],
): FilenameDomainIndex {
  const byKey = new Map<string, FilenameDomainEntry>();
  const labels = new Map<string, Map<string, number>>();
  const seenPaths = new Map<string, Set<string>>();

  for (const file of files) {
    const stem = extractFilenameStem(file.path);
    if (!stem) continue;
    const layer = file.layer || "unknown";
    let entry = byKey.get(stem.key);
    if (!entry) {
      entry = {
        key: stem.key,
        label: stem.label,
        layers: new Set(),
        filePaths: [],
      };
      byKey.set(stem.key, entry);
      labels.set(stem.key, new Map());
      seenPaths.set(stem.key, new Set());
    }
    entry.layers.add(layer);
    const paths = seenPaths.get(stem.key)!;
    if (!paths.has(file.path)) {
      paths.add(file.path);
      entry.filePaths.push(file.path);
    }
    const spelling = labels.get(stem.key)!;
    spelling.set(stem.label, (spelling.get(stem.label) ?? 0) + 1);
  }

  for (const [key, entry] of byKey) {
    entry.label = modeLabel(labels.get(key) ?? new Map([[entry.label, 1]]));
  }

  return { byKey };
}

function buildContainsEdgeIdsByTarget(state: GraphBuilderState): Map<string, string[]> {
  const byTarget = new Map<string, string[]>();
  for (const [edgeId, edge] of state.edges) {
    if (edge.kind !== "contains") continue;
    const list = byTarget.get(edge.targetId);
    if (list) list.push(edgeId);
    else byTarget.set(edge.targetId, [edgeId]);
  }
  return byTarget;
}

function remountFileToFilenameDomain(
  state: GraphBuilderState,
  projectId: string,
  filePath: string,
  fileId: string,
  domainLabel: string,
  containsByTarget: Map<string, string[]>,
): void {
  const layerName = detectLayer(filePath) || UNASSIGNED_DOMAIN;
  const moduleName = domainLabel;
  const appScope = createApplicationScope(projectId);
  const domainScope = createDomainScope(domainLabel, projectId);
  const layerScope = createLayerScope(layerName, domainLabel);
  const moduleScope = createModuleScope(moduleName, domainLabel, layerName);

  if (!state.scopes.has(domainScope.id)) {
    addScope(state, domainScope);
    registerKnownId(state.registry, "node", domainScope.id);
    addNode(state, {
      id: domainScope.id,
      kind: "domain",
      label: domainLabel,
      scopeId: appScope.id,
      metadata: { domainSource: "filename" },
    });
    addEdge(state, {
      id: stableUniqueId(state.registry, "edge", createId("edge", appScope.id, domainScope.id)),
      kind: "contains",
      sourceId: appScope.id,
      targetId: domainScope.id,
      metadata: {},
    });
  }

  if (!state.scopes.has(layerScope.id)) {
    addScope(state, layerScope);
    registerKnownId(state.registry, "node", layerScope.id);
    addNode(state, {
      id: layerScope.id,
      kind: "layer",
      label: layerName,
      scopeId: domainScope.id,
      metadata: { layer: layerName },
    });
    addEdge(state, {
      id: stableUniqueId(state.registry, "edge", createId("edge", domainScope.id, layerScope.id)),
      kind: "contains",
      sourceId: domainScope.id,
      targetId: layerScope.id,
      metadata: {},
    });
  }

  if (!state.scopes.has(moduleScope.id)) {
    addScope(state, moduleScope);
    registerKnownId(state.registry, "node", moduleScope.id);
    addNode(state, {
      id: moduleScope.id,
      kind: "module",
      label: moduleName,
      scopeId: layerScope.id,
      metadata: { layer: layerName },
    });
    addEdge(state, {
      id: stableUniqueId(state.registry, "edge", createId("edge", layerScope.id, moduleScope.id)),
      kind: "contains",
      sourceId: layerScope.id,
      targetId: moduleScope.id,
      metadata: {},
    });
  }

  const fileNode = state.nodes.get(fileId);
  if (!fileNode) return;

  const incoming = containsByTarget.get(fileId) ?? [];
  for (const edgeId of incoming) {
    state.edges.delete(edgeId);
  }
  containsByTarget.delete(fileId);

  fileNode.scopeId = moduleScope.id;
  fileNode.metadata = {
    ...fileNode.metadata,
    layer: layerName,
    domainSource: "filename",
  };

  const fileScope = state.scopes.get(fileId);
  if (fileScope) {
    fileScope.parentId = moduleScope.id;
  }

  const newEdgeId = stableUniqueId(
    state.registry,
    "edge",
    createId("edge", moduleScope.id, fileId),
  );
  addEdge(state, {
    id: newEdgeId,
    kind: "contains",
    sourceId: moduleScope.id,
    targetId: fileId,
    metadata: {},
  });
  containsByTarget.set(fileId, [newEdgeId]);
}

function isRemountEligible(domainSource: unknown): boolean {
  return domainSource === "none" || domainSource === undefined;
}

/**
 * Pass 2: remount unassigned / domainSource-none files onto filename domains.
 * Never mutates nodes that already have domainSource "path".
 * Candidate index is built only from remount-eligible files so path domains
 * cannot inflate filename-domain thresholds.
 */
export function applyFilenameDomains(state: GraphBuilderState, projectId: string): void {
  const fileNodes = [...state.nodes.values()].filter(
    (node) => node.kind === "file" && typeof node.filePath === "string",
  );
  const remountCandidates = fileNodes.filter((node) =>
    isRemountEligible(node.metadata?.domainSource),
  );
  const entries = remountCandidates.map((node) => ({
    path: node.filePath!,
    layer: detectLayer(node.filePath!),
  }));
  const index = buildFilenameDomainIndex(entries);
  const containsByTarget = buildContainsEdgeIdsByTarget(state);

  for (const node of remountCandidates) {
    const stem = extractFilenameStem(node.filePath!);
    if (!stem) continue;
    const entry = index.byKey.get(stem.key);
    if (!entry || !isFilenameDomainCandidate(entry)) continue;

    remountFileToFilenameDomain(
      state,
      projectId,
      node.filePath!,
      node.id,
      entry.label,
      containsByTarget,
    );
  }
}
