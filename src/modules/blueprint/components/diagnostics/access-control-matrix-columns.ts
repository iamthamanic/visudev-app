/**
 * Matrix column ↔ access-control control mapping (shared by matrix + inspector).
 * Location: src/modules/blueprint/components/diagnostics/access-control-matrix-columns.ts
 */

import type { AccessControlControl } from "../../../../lib/visudev/access-control-types";

export type MatrixControlColumn =
  | "authentication"
  | "authorization"
  | "resourceScope"
  | "tenantIsolation"
  | "ownership"
  | "validation"
  | "rateLimit"
  | "audit";

export const MATRIX_COLUMN_TO_CONTROL: Record<MatrixControlColumn, AccessControlControl> = {
  authentication: "authentication",
  authorization: "authorization",
  resourceScope: "resource-scope",
  tenantIsolation: "tenant-isolation",
  ownership: "ownership",
  validation: "validation",
  rateLimit: "rate-limit",
  audit: "audit",
};

/** Kurzlabels in der Matrix-Kopfzeile. */
export const MATRIX_HEADER_LABELS = {
  route: "Route",
  authentication: "AuthN",
  authorization: "AuthZ",
  resourceScope: "Scope",
  tenantIsolation: "Tenant",
  ownership: "Ownership",
  validation: "Validation",
  rateLimit: "Rate Limit",
  audit: "Audit",
  findings: "Findings",
  status: "Status",
} as const;

/** Deutsch erklärte Tooltips für jede Spalte. */
export const MATRIX_HEADER_TOOLTIPS: Record<keyof typeof MATRIX_HEADER_LABELS, string> = {
  route: "API-Endpunkt: HTTP-Methode und Pfad der untersuchten Route.",
  authentication:
    "Authentifizierung (AuthN): Wird geprüft, wer den Aufruf macht (Login, Token, Session)?",
  authorization:
    "Autorisierung (AuthZ): Darf dieser Aufrufer die Aktion ausführen (Rollen, Policies)?",
  resourceScope:
    "Resource Scope: Ist der Zugriff auf die konkrete Ressource begrenzt (z. B. nur eigene IDs)?",
  tenantIsolation: "Tenant-Isolation: Sind Mandanten-/Organisationsdaten voneinander getrennt?",
  ownership: "Ownership: Gehört die Ressource dem Aufrufer (ownerId / userId-Check)?",
  validation: "Validation: Werden Eingaben (Body, Query, Params) geprüft und ungültige abgewiesen?",
  rateLimit: "Rate Limit: Gibt es Drosselung gegen Missbrauch und Brute-Force?",
  audit: "Audit: Wird der Zugriff oder Sicherheitsereignisse protokolliert?",
  findings: "Findings: Anzahl der erkannten Sicherheitsbefunde für diese Route.",
  status: "Status: Gesamtbewertung der Access-Controls für diese Route.",
};
