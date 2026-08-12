/**
 * Ensures domain/layer/module/file scope hierarchy exists for a file path.
 */

import {
  detectDomain,
  detectLayer,
  detectModule,
  inferRuntime,
  normalizePath,
} from "./_heuristics.js";
import { createId, registerKnownId, stableUniqueId } from "./_ids.js";
import { addEdge, addNode, addScope, type GraphBuilderState } from "./_state.js";
import {
  createDomainScope,
  createFileScope,
  createLayerScope,
  createModuleScope,
} from "./_scopes.js";

const UNASSIGNED = "unassigned";

export interface FileContext {
  domainId: string;
  layerId: string;
  moduleId: string;
  fileId: string;
}

export function ensureFileContext(
  filePath: string,
  projectId: string,
  state: GraphBuilderState,
): FileContext {
  const domain = detectDomain(filePath) || UNASSIGNED;
  const layerName = detectLayer(filePath) || UNASSIGNED;
  const moduleName = detectModule(filePath, domain) || UNASSIGNED;
  const appId = `app:${projectId}`;
  const domainId = `domain:${domain}`;
  const layerId = `layer:${domain}:${layerName}`;
  const moduleId = `module:${domain}:${layerName}:${moduleName}`;
  const fileId = `file:${normalizePath(filePath)}`;

  if (!state.scopes.has(domainId)) {
    addScope(state, createDomainScope(domain, projectId));
    registerKnownId(state.registry, "node", domainId);
    addNode(state, { id: domainId, kind: "domain", label: domain, scopeId: appId, metadata: {} });
    addEdge(state, {
      id: stableUniqueId(state.registry, "edge", createId("edge", appId, domainId)),
      kind: "contains",
      sourceId: appId,
      targetId: domainId,
      metadata: {},
    });
  }

  if (!state.scopes.has(layerId)) {
    addScope(state, createLayerScope(layerName, domain));
    registerKnownId(state.registry, "node", layerId);
    addNode(state, {
      id: layerId,
      kind: "layer",
      label: layerName,
      scopeId: domainId,
      metadata: { layer: layerName },
    });
    addEdge(state, {
      id: stableUniqueId(state.registry, "edge", createId("edge", domainId, layerId)),
      kind: "contains",
      sourceId: domainId,
      targetId: layerId,
      metadata: {},
    });
  }

  if (!state.scopes.has(moduleId)) {
    addScope(state, createModuleScope(moduleName, domain, layerName));
    registerKnownId(state.registry, "node", moduleId);
    addNode(state, {
      id: moduleId,
      kind: "module",
      label: moduleName,
      scopeId: layerId,
      metadata: { layer: layerName },
    });
    addEdge(state, {
      id: stableUniqueId(state.registry, "edge", createId("edge", layerId, moduleId)),
      kind: "contains",
      sourceId: layerId,
      targetId: moduleId,
      metadata: {},
    });
  }

  if (!state.scopes.has(fileId)) {
    addScope(state, createFileScope(filePath, moduleId));
    registerKnownId(state.registry, "node", fileId);
    addNode(state, {
      id: fileId,
      kind: "file",
      label: filePath.split("/").pop() || filePath,
      scopeId: moduleId,
      filePath,
      metadata: { runtime: inferRuntime(filePath), layer: layerName },
    });
    addEdge(state, {
      id: stableUniqueId(state.registry, "edge", createId("edge", moduleId, fileId)),
      kind: "contains",
      sourceId: moduleId,
      targetId: fileId,
      metadata: {},
    });
  }

  return { domainId, layerId, moduleId, fileId };
}
