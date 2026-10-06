/**
 * Consequence-first Diagnostics finding presenter (PU-13).
 * Deterministic, epistemic-safe claims — never invents business impact.
 * Location: shared/product-understanding/project-diagnostics-consequences.ts
 */

export type DiagnosticsConsequenceConfidence = "grounded" | "unclear";

export interface DiagnosticsFindingConsequenceInput {
  id: string;
  ruleId: string;
  category: string;
  message: string;
  expectedState: string;
  actualState: string;
  confidence: number;
  remediation?: string;
}

export interface DiagnosticsFindingConsequenceView {
  findingId: string;
  /** Primary headline for cards/inspector — never a bare rule id. */
  consequenceTitle: string;
  whyItMatters: string;
  observation: string;
  confidenceLabel: string;
  consequenceConfidence: DiagnosticsConsequenceConfidence;
  /** Technical drill-down (Level 2/3). */
  ruleId: string;
  mechanismSummary: string;
  remediation: string | null;
}

const UNCLEAR_TITLE = "Auswirkung unklar";
const UNCLEAR_WHY =
  "Die Produkt-/Nutzerauswirkung lässt sich aus dem vorliegenden Finding nicht sicher ableiten.";

interface ConsequenceTemplate {
  match: (input: DiagnosticsFindingConsequenceInput) => boolean;
  title: string;
  why: string;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function haystack(input: DiagnosticsFindingConsequenceInput): string {
  return normalize(
    [input.ruleId, input.category, input.message, input.expectedState, input.actualState].join(" "),
  );
}

const TEMPLATES: ConsequenceTemplate[] = [
  {
    match: (input) =>
      /tenant|isolation|rls|row.level|multi.?tenant/.test(haystack(input)) ||
      normalize(input.ruleId).includes("tenant-isolation"),
    title: "Daten könnten zwischen Mandanten sichtbar werden",
    why: "Fehlende Mandantentrennung gefährdet Vertraulichkeit und Compliance.",
  },
  {
    match: (input) =>
      /\bauth\b|unprotected|unauthenticated|login|session|jwt|oauth/.test(haystack(input)) ||
      normalize(input.ruleId).includes("missing-auth"),
    title: "Unbefugte könnten geschützte Funktionen nutzen",
    why: "Ohne nachweisbaren Zugriffsschutz ist die Route für unautorisierte Aufrufe offen.",
  },
  {
    match: (input) =>
      /validat|schema|zod|sanitize|input/.test(haystack(input)) ||
      normalize(input.ruleId).includes("missing-validation"),
    title: "Ungültige Daten könnten gespeichert oder verarbeitet werden",
    why: "Fehlende Eingabeprüfung erhöht das Risiko korrupter oder unsicherer Daten.",
  },
  {
    match: (input) => /rate.?limit|throttl|ddos|abuse/.test(haystack(input)),
    title: "Die Funktion könnte unter Last missbraucht werden",
    why: "Ohne Ratenbegrenzung sind Überlast und missbräuchliche Nutzung wahrscheinlicher.",
  },
  {
    match: (input) => /aria|a11y|accessibility|label/.test(haystack(input)),
    title: "Nutzer mit Hilfstechnologien könnten die Oberfläche nicht bedienen",
    why: "Fehlende Zugänglichkeitskennzeichnung schließt Teile der Nutzerschaft aus.",
  },
  {
    match: (input) => /secret|credential|api.?key|token.?leak|hardcod/.test(haystack(input)),
    title: "Geheimnisse könnten ungewollt offengelegt werden",
    why: "Sichtbare Credentials ermöglichen Missbrauch von Integrationen und Daten.",
  },
  {
    match: (input) => /cors|csrf|xss|injection|sql.?inject/.test(haystack(input)),
    title: "Angreifer könnten Nutzeraktionen oder Daten manipulieren",
    why: "Klassische Web-Schwachstellen betreffen direkt Integrität und Vertraulichkeit.",
  },
  {
    match: (input) => /audit|logging|observab/.test(haystack(input)),
    title: "Sicherheitsrelevante Vorgänge könnten unbemerkt bleiben",
    why: "Ohne Audit-Spuren fehlen Nachweise für Vorfälle und Compliance.",
  },
];

function normalizeConfidence(confidence: number): number {
  if (!Number.isFinite(confidence)) return Number.NaN;
  // Findings historically use 0–100; Product Understanding uses 0–1.
  return confidence > 1 ? confidence / 100 : confidence;
}

function confidenceLabel(confidence: number): string {
  const normalized = normalizeConfidence(confidence);
  if (!Number.isFinite(normalized)) return "Confidence unbekannt";
  if (normalized >= 0.8) return "Hohe Confidence";
  if (normalized >= 0.5) return "Mittlere Confidence";
  return "Niedrige Confidence — nicht als bestätigt formulieren";
}

function observationFor(input: DiagnosticsFindingConsequenceInput): string {
  const expected = input.expectedState.trim() || "unbekannt";
  const actual = input.actualState.trim() || "unbekannt";
  const message = input.message.trim();
  if (message) {
    return `VisuDev beobachtet: ${message} (erwartet: ${expected}, gefunden: ${actual}).`;
  }
  return `VisuDev beobachtet Abweichung — erwartet: ${expected}, gefunden: ${actual}.`;
}

function mechanismSummary(input: DiagnosticsFindingConsequenceInput): string {
  const rule = input.ruleId.trim() || "unbekannte Regel";
  const category = input.category.trim() || "Allgemein";
  return `Regel ${rule} · Kategorie ${category}.`;
}

/**
 * Present a finding consequence-first. Unknown mappings → honest unclear copy.
 */
export function presentDiagnosticsFindingConsequence(
  input: DiagnosticsFindingConsequenceInput,
): DiagnosticsFindingConsequenceView {
  const template = TEMPLATES.find((entry) => entry.match(input));
  const normalized = normalizeConfidence(input.confidence);
  const lowConfidence = !Number.isFinite(normalized) || normalized < 0.4;
  const grounded = Boolean(template) && !lowConfidence;

  if (!grounded || !template) {
    return {
      findingId: input.id,
      consequenceTitle: UNCLEAR_TITLE,
      whyItMatters: UNCLEAR_WHY,
      observation: observationFor(input),
      confidenceLabel: confidenceLabel(input.confidence),
      consequenceConfidence: "unclear",
      ruleId: input.ruleId,
      mechanismSummary: mechanismSummary(input),
      remediation: input.remediation?.trim() || null,
    };
  }

  return {
    findingId: input.id,
    consequenceTitle: template.title,
    whyItMatters: template.why,
    observation: observationFor(input),
    confidenceLabel: confidenceLabel(input.confidence),
    consequenceConfidence: "grounded",
    ruleId: input.ruleId,
    mechanismSummary: mechanismSummary(input),
    remediation: input.remediation?.trim() || null,
  };
}

export function presentDiagnosticsFindingConsequences(
  findings: readonly DiagnosticsFindingConsequenceInput[],
): DiagnosticsFindingConsequenceView[] {
  return findings.map(presentDiagnosticsFindingConsequence);
}

/** Group label for density-reduced overview (consequence title or unclear). */
export function diagnosticsConsequenceGroupKey(view: DiagnosticsFindingConsequenceView): string {
  return view.consequenceTitle;
}
