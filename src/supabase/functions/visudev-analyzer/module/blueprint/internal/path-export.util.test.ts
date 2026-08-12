/** Unit tests for path-export.util (UI-safe sample paths + diverse catalogs). */

import { assertEquals } from "std/assert";
import {
  sanitizePathCatalog,
  selectDiversePaths,
  toExportSamplePath,
} from "./path-export.util.ts";

Deno.test("toExportSamplePath strips absolute root hint", () => {
  assertEquals(
    toExportSamplePath(
      "/Users/me/proj/backend/app/routes.ts",
      "/Users/me/proj",
    ),
    "backend/app/routes.ts",
  );
});

Deno.test("toExportSamplePath truncates bare absolute paths without username leak", () => {
  const sample = toExportSamplePath(
    "/Users/alice/code/repo/src/routes/employees.ts",
  );
  assertEquals(sample.includes("alice"), false);
  assertEquals(sample.includes("Users"), false);
  assertEquals(sample, "src/routes/employees.ts");
});

Deno.test("toExportSamplePath home path without markers keeps only trailing segments", () => {
  const sample = toExportSamplePath("/home/bob/secret-project/lib/util.py");
  assertEquals(sample.includes("bob"), false);
  assertEquals(sample.includes("home"), false);
  assertEquals(sample, "secret-project/lib/util.py");
});

Deno.test("toExportSamplePath strips embedded Users prefix without repo markers", () => {
  const sample = toExportSamplePath("/tmp/Users/alice/project/file.ts");
  assertEquals(sample.includes("alice"), false);
  assertEquals(sample.includes("Users"), false);
  assertEquals(sample, "project/file.ts");
});

Deno.test("toExportSamplePath strips embedded Users even with deeper nesting", () => {
  const sample = toExportSamplePath(
    "/var/folders/xx/Users/alice/code/myapp/lib/util.py",
  );
  assertEquals(sample.includes("alice"), false);
  assertEquals(sample.includes("Users"), false);
  assertEquals(sample, "code/myapp/lib/util.py");
});

Deno.test("toExportSamplePath keeps legitimate project home/ segments via markers", () => {
  const sample = toExportSamplePath(
    "/Users/alice/repos/app/src/home/components/Button.ts",
  );
  assertEquals(sample, "src/home/components/Button.ts");
  assertEquals(sample.includes("alice"), false);
});

Deno.test("toExportSamplePath strips Windows drive + Users home paths", () => {
  const withSlash = toExportSamplePath("C:/Users/alice/repo/src/a.ts");
  assertEquals(withSlash.includes("alice"), false);
  assertEquals(withSlash, "src/a.ts");

  const noSlash = toExportSamplePath("C:Users/alice/repo/src/b.ts");
  assertEquals(noSlash.includes("alice"), false);
  assertEquals(noSlash, "src/b.ts");
});

Deno.test("selectDiversePaths round-robins second-level buckets", () => {
  const paths = [
    "erpnext/accounts/a.py",
    "erpnext/accounts/b.py",
    "erpnext/buying/c.py",
    "erpnext/crm/d.py",
    "erpnext/stock/e.py",
  ];
  const selected = selectDiversePaths(paths, 4);
  assertEquals(selected.length, 4);
  const domains = new Set(
    selected.map((p) => p.split("/")[1]),
  );
  assertEquals(domains.size >= 3, true);
});

Deno.test("sanitizePathCatalog caps and relativizes", () => {
  const catalog = sanitizePathCatalog(
    [
      "/tmp/repo/erpnext/accounts/x.py",
      "/tmp/repo/erpnext/buying/y.py",
    ],
    "/tmp/repo",
    10,
  );
  assertEquals(catalog, [
    "erpnext/accounts/x.py",
    "erpnext/buying/y.py",
  ]);
});
