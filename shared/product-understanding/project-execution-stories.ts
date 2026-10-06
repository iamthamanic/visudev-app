/**
 * Execution user-to-system stories from ProductUnderstandingModel (PU-10).
 * Default read model: meaningful actions with plain-language steps — not routes/files.
 * Location: shared/product-understanding/project-execution-stories.ts
 */

import {
  isAuthoritativeKnowledgeStatus,
  type KnowledgeStatus,
} from "../scan-detector/epistemic.js";
import type {
  ProductConcept,
  ProductStoryStepRole,
  ProductUnderstandingModel,
  ProductUserSystemStory,
} from "../product-understanding.types.js";
import type { SoftwareGraph } from "../software-graph.types.js";

export const EXECUTION_STORY_MAX = 40;

export type ExecutionStoryObservation =
  | "STATIC_MODEL"
  | "RUNTIME_VERIFIED"
  | "OBSERVED_TRACE"
  | "CONFLICTED";

export interface ExecutionStoryStepView {
  id: string;
  role: ProductStoryStepRole;
  /** Everyday-language step label (DE). */
  label: string;
  conceptId: string | null;
  /** Linked SoftwareGraph node when evidenced; never invented. */
  nodeId: string | null;
  observationClass: ExecutionStoryObservation;
  knowledgeStatus: KnowledgeStatus;
  evidenceCount: number;
  /** Always null without measured runtime evidence (Honest-Core). */
  durationMs: null;
}

export interface ExecutionStoryView {
  id: string;
  title: string;
  summary: string;
  steps: ExecutionStoryStepView[];
  knowledgeStatus: KnowledgeStatus;
  evidenceCount: number;
  /** Matched HTTP/route id for technical drill-down, if any. */
  routeId: string | null;
  confirmed: boolean;
}

export interface ExecutionStoriesProjection {
  stories: ExecutionStoryView[];
  partial: boolean;
  partialReason: string | null;
}

const ROLE_LABEL_DE: Record<ProductStoryStepRole, string> = {
  actor: "Akteur",
  action: "Aktion",
  system: "Systemreaktion",
  data: "Speicherung / Daten",
  outcome: "Sichtbares Ergebnis",
};

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/gi, " ")
    .replace(/\s+/g, " ");
}

function observationFromStatus(status: KnowledgeStatus): ExecutionStoryObservation {
  if (status === "CONFLICTED") return "CONFLICTED";
  if (status === "VERIFIED") return "RUNTIME_VERIFIED";
  if (status === "SUPPORTED") return "OBSERVED_TRACE";
  return "STATIC_MODEL";
}

function matchRouteId(graph: SoftwareGraph | null | undefined, actionLabel: string): string | null {
  if (!graph) return null;
  const needle = normalize(actionLabel);
  if (!needle) return null;
  const routes = graph.nodes.filter((node) => node.kind === "route");
  let best: { id: string; score: number } | null = null;
  for (const route of routes) {
    const hay = normalize(`${route.label} ${route.filePath ?? ""}`);
    if (!hay) continue;
    let score = 0;
    if (hay === needle) score = 3;
    else if (hay.includes(needle) || needle.includes(hay)) score = 2;
    else if (hay.split(" ").some((part) => part.length > 3 && needle.includes(part))) score = 1;
    if (score === 0) continue;
    if (
      !best ||
      score > best.score ||
      (score === best.score && route.id.localeCompare(best.id) < 0)
    ) {
      best = { id: route.id, score };
    }
  }
  return best && best.score >= 2 ? best.id : null;
}

function relatedConcepts(
  model: ProductUnderstandingModel,
  actionId: string,
  kinds: Set<ProductConcept["kind"]>,
): ProductConcept[] {
  const byId = new Map(model.concepts.map((concept) => [concept.id, concept]));
  const found: ProductConcept[] = [];
  for (const relation of model.relations) {
    const otherId =
      relation.sourceConceptId === actionId
        ? relation.targetConceptId
        : relation.targetConceptId === actionId
          ? relation.sourceConceptId
          : null;
    if (!otherId) continue;
    const concept = byId.get(otherId);
    if (!concept || !kinds.has(concept.kind)) continue;
    if (found.some((entry) => entry.id === concept.id)) continue;
    found.push(concept);
  }
  return found;
}

function stepView(
  storyId: string,
  role: ProductStoryStepRole,
  label: string,
  concept: ProductConcept | null,
  nodeId: string | null,
): ExecutionStoryStepView {
  const knowledgeStatus = concept?.knowledgeStatus ?? "UNKNOWN";
  const evidenceCount = concept?.evidence.length ?? 0;
  return {
    id: `${storyId}:${role}`,
    role,
    label,
    conceptId: concept?.id ?? null,
    nodeId,
    observationClass: observationFromStatus(knowledgeStatus),
    knowledgeStatus,
    evidenceCount,
    durationMs: null,
  };
}

/**
 * Build ProductUserSystemStory records for the PU model (contract fill).
 */
export function buildProductUserSystemStories(
  model: Omit<ProductUnderstandingModel, "stories"> & { stories?: ProductUserSystemStory[] },
): ProductUserSystemStory[] {
  const actions = model.concepts.filter((concept) => concept.kind === "user-action");
  const stories: ProductUserSystemStory[] = [];
  for (const action of actions.slice(0, EXECUTION_STORY_MAX)) {
    const system =
      relatedConcepts(
        model as ProductUnderstandingModel,
        action.id,
        new Set(["capability", "system-part"]),
      ).at(0) ?? null;
    const data =
      relatedConcepts(model as ProductUnderstandingModel, action.id, new Set(["information"])).at(
        0,
      ) ?? null;
    const steps = [
      { conceptId: action.id, role: "action" as const, label: action.label },
      {
        conceptId: system?.id ?? action.id,
        role: "system" as const,
        label: system?.label ?? "Systemreaktion (nicht belegt)",
      },
      {
        conceptId: data?.id ?? action.id,
        role: "data" as const,
        label: data?.label ?? "Speicherung (nicht belegt)",
      },
      {
        conceptId: action.id,
        role: "outcome" as const,
        label: `Ergebnis nach „${action.label}“`,
      },
    ];
    stories.push({
      id: `pu-story:${action.id}`,
      title: action.label,
      summary: `Nutzeraktion „${action.label}“ und nachfolgende Systemschritte.`,
      steps,
      knowledgeStatus: action.knowledgeStatus,
      evidence: action.evidence,
    });
  }
  stories.sort((left, right) => left.title.localeCompare(right.title));
  return stories;
}

/**
 * Project stories for Execution UI: plain-language steps + epistemic honesty.
 */
export function projectExecutionStories(
  model: ProductUnderstandingModel,
  software: SoftwareGraph | null | undefined = null,
): ExecutionStoriesProjection {
  const sourceStories =
    model.stories.length > 0 ? model.stories : buildProductUserSystemStories(model);
  const conceptsById = new Map(model.concepts.map((concept) => [concept.id, concept]));
  const stories: ExecutionStoryView[] = [];

  for (const story of sourceStories.slice(0, EXECUTION_STORY_MAX)) {
    const actionConcept =
      conceptsById.get(story.steps.find((step) => step.role === "action")?.conceptId ?? "") ??
      model.concepts.find((concept) => concept.id === story.id.replace(/^pu-story:/, "")) ??
      null;
    const routeId = matchRouteId(software, story.title);
    const steps: ExecutionStoryStepView[] = [];

    for (const step of story.steps) {
      const concept = conceptsById.get(step.conceptId) ?? null;
      const rolePrefix = ROLE_LABEL_DE[step.role];
      const honestLabel =
        step.role === "outcome"
          ? concept &&
            isAuthoritativeKnowledgeStatus(concept.knowledgeStatus) &&
            concept.evidence.length > 0
            ? `${rolePrefix}: ${step.label}`
            : `${rolePrefix}: nicht als bestätigt belegt`
          : `${rolePrefix}: ${step.label}`;
      steps.push(
        stepView(
          story.id,
          step.role,
          honestLabel,
          concept,
          routeId && step.role === "action" ? routeId : null,
        ),
      );
    }

    if (!steps.some((step) => step.role === "outcome")) {
      steps.push(
        stepView(
          story.id,
          "outcome",
          `${ROLE_LABEL_DE.outcome}: nicht als bestätigt belegt`,
          null,
          null,
        ),
      );
    }

    const confirmed =
      isAuthoritativeKnowledgeStatus(story.knowledgeStatus) && story.evidence.length > 0;
    stories.push({
      id: story.id,
      title: story.title,
      summary: story.summary,
      steps,
      knowledgeStatus: story.knowledgeStatus,
      evidenceCount: story.evidence.length,
      routeId,
      confirmed,
    });
  }

  const partial =
    stories.length === 0 || stories.some((story) => !story.confirmed || story.routeId == null);
  let partialReason: string | null = null;
  if (stories.length === 0) {
    partialReason = "Keine Nutzeraktionen für Execution-Stories ableitbar.";
  } else if (stories.some((story) => !story.confirmed)) {
    partialReason = "Enthält unbestätigte Stories (INTERPRETED/UNKNOWN/CONFLICTED).";
  } else if (stories.some((story) => story.routeId == null)) {
    partialReason = "Technische Route-Verknüpfung teilweise unbelegt.";
  }

  return { stories, partial, partialReason };
}
