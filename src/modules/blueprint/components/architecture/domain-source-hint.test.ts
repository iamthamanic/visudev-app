/**
 * Unit tests for Architecture domainSource hint copy (P0-14).
 * Location: src/modules/blueprint/components/architecture/domain-source-hint.test.ts
 */

import { describe, expect, it } from "vitest";
import {
  DOMAIN_SOURCE_HINT_FILENAME,
  DOMAIN_SOURCE_HINT_NONE,
  collectFileDomainSources,
  domainSourceHintText,
  majorityDomainSource,
} from "./domain-source-hint";

describe("domainSourceHintText", () => {
  it("returns null when path dominates", () => {
    expect(domainSourceHintText(["path", "path", "none"])).toBeNull();
  });

  it("returns filename banner when filename dominates", () => {
    expect(domainSourceHintText(["filename", "filename", "none"])).toBe(
      DOMAIN_SOURCE_HINT_FILENAME,
    );
  });

  it("returns none banner when none dominates", () => {
    expect(domainSourceHintText(["none", "none", "path"])).toBe(DOMAIN_SOURCE_HINT_NONE);
  });

  it("collects file node sources", () => {
    expect(
      majorityDomainSource(
        collectFileDomainSources([
          { kind: "domain", metadata: { domainSource: "path" } },
          { kind: "file", metadata: { domainSource: "filename" } },
          { kind: "file", metadata: { domainSource: "filename" } },
        ]),
      ),
    ).toBe("filename");
  });
});
