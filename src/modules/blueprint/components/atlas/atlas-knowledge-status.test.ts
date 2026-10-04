/**
 * Tests for Atlas KnowledgeStatus display helpers (PR-06).
 */

import { describe, expect, it } from "vitest";
import {
  atlasKnowledgeStatusLabel,
  atlasKnowledgeTone,
  isWeakKnowledgeStatus,
} from "./atlas-knowledge-status.js";

describe("atlas-knowledge-status", () => {
  it("labels and tones distinguish strong vs weak statuses", () => {
    expect(atlasKnowledgeStatusLabel("VERIFIED")).toBe("Verifiziert");
    expect(atlasKnowledgeStatusLabel("INTERPRETED")).toBe("Interpretiert");
    expect(atlasKnowledgeTone("VERIFIED")).toBe("strong");
    expect(atlasKnowledgeTone("SUPPORTED")).toBe("strong");
    expect(atlasKnowledgeTone("INTERPRETED")).toBe("weak");
    expect(atlasKnowledgeTone("UNKNOWN")).toBe("weak");
    expect(atlasKnowledgeTone("CONFLICTED")).toBe("conflict");
    expect(isWeakKnowledgeStatus("INTERPRETED")).toBe(true);
    expect(isWeakKnowledgeStatus("VERIFIED")).toBe(false);
  });
});
