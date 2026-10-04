/**
 * Tests for Atlas semantic evidence / KnowledgeStatus inspector section (PR-06).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SemanticEntity } from "../../../../../shared/semantic-system-model.types.js";
import { AtlasSemanticEvidenceSection } from "./AtlasSemanticEvidenceSection.js";

const entity: SemanticEntity = {
  id: "semantic:business-domain:leave",
  kind: "business-domain",
  label: "Leave",
  confidence: 0.91,
  knowledgeStatus: "VERIFIED",
  evidence: [{ source: "graph-node", refId: "svc:leave" }],
  metadata: {},
};

describe("AtlasSemanticEvidenceSection", () => {
  it("renders KnowledgeStatus, confidence, and evidence", () => {
    render(<AtlasSemanticEvidenceSection entity={entity} />);
    expect(screen.getByTestId("atlas-knowledge-status")).toHaveAttribute("data-tone", "strong");
    expect(screen.getByTestId("atlas-knowledge-status")).toHaveTextContent("Verifiziert");
    expect(screen.getByTestId("atlas-confidence")).toHaveTextContent("91,0");
    expect(screen.getByTestId("atlas-evidence-list")).toHaveTextContent("graph-node: svc:leave");
  });

  it("marks INTERPRETED as weak tone", () => {
    render(
      <AtlasSemanticEvidenceSection
        entity={{ ...entity, knowledgeStatus: "INTERPRETED", confidence: 0.4 }}
      />,
    );
    expect(screen.getByTestId("atlas-knowledge-status")).toHaveAttribute("data-tone", "weak");
  });
});
