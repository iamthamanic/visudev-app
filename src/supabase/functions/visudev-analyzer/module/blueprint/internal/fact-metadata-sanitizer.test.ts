/** Unit tests for fact metadata allowlist / path retention (P0-9). */

import { assertEquals } from "std/assert";
import { sanitizeFactMetadataForExport } from "./fact-metadata-sanitizer.ts";

Deno.test("keeps resolvedPath in exported metadata", () => {
  const metadata = sanitizeFactMetadataForExport({
    resolvedPath: "src/services/order.service.ts",
  });
  assertEquals(metadata.resolvedPath, "src/services/order.service.ts");
});

Deno.test("keeps targetFile in exported metadata", () => {
  const metadata = sanitizeFactMetadataForExport({
    targetFile: "src/repositories/order.repository.ts",
  });
  assertEquals(metadata.targetFile, "src/repositories/order.repository.ts");
});

Deno.test("does not redact a long file path", () => {
  const longPath =
    "src/supabase/functions/visudev-analyzer/module/blueprint/graph/import-resolver.ts";
  assertEquals(longPath.length > 64, true);
  const metadata = sanitizeFactMetadataForExport({
    resolvedPath: longPath,
  });
  assertEquals(metadata.resolvedPath, longPath);
});

Deno.test("still redacts an email in a non-path value", () => {
  const metadata = sanitizeFactMetadataForExport({
    method: "user@example.com",
  });
  assertEquals(metadata.method, "***@***");
});

Deno.test("still drops keys outside the allowlist", () => {
  const metadata = sanitizeFactMetadataForExport({
    secretToken: "abc",
    resolvedPath: "a.ts",
  });
  assertEquals(metadata.secretToken, undefined);
  assertEquals(metadata.resolvedPath, "a.ts");
});
