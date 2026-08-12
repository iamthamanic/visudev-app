/** Unit tests for relative import resolution (P0-9 NodeNext rewrite). */

import { assertEquals } from "std/assert";
import { resolveImport } from "./import-resolver.ts";

Deno.test("resolves .js specifier to .ts file", () => {
  const known = new Set(["dir/a.ts"]);
  assertEquals(resolveImport("./a.js", "dir/from.ts", known), "dir/a.ts");
});

Deno.test("prefers exact .js match over .ts rewrite", () => {
  const known = new Set(["dir/a.js", "dir/a.ts"]);
  assertEquals(resolveImport("./a.js", "dir/from.ts", known), "dir/a.js");
});

Deno.test("resolves .js specifier to index.ts", () => {
  const known = new Set(["dir/handlers/index.ts"]);
  assertEquals(
    resolveImport("./handlers.js", "dir/from.ts", known),
    "dir/handlers/index.ts",
  );
});

Deno.test("resolves .mjs and .cjs specifiers", () => {
  assertEquals(
    resolveImport("./mod.mjs", "pkg/from.ts", new Set(["pkg/mod.mts"])),
    "pkg/mod.mts",
  );
  assertEquals(
    resolveImport("./mod.cjs", "pkg/from.ts", new Set(["pkg/mod.cts"])),
    "pkg/mod.cts",
  );
});

Deno.test("returns null for package specifier", () => {
  assertEquals(
    resolveImport("express", "dir/from.ts", new Set(["dir/express.ts"])),
    null,
  );
});

Deno.test("resolves extensionless specifier", () => {
  const known = new Set(["dir/util.ts"]);
  assertEquals(resolveImport("./util", "dir/from.ts", known), "dir/util.ts");
});
