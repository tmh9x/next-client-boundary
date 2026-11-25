import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { checkProject, type Finding } from "../src/check.js";
import type { Config } from "../src/rules.js";

const root = fileURLToPath(new URL("./fixtures/app", import.meta.url));
const config = JSON.parse(readFileSync(join(root, "client-boundary.config.json"), "utf8")) as Config;
const findings = checkProject({ root, config });
const forFile = (file: string): Finding[] => findings.filter((finding) => finding.file === `src/components/${file}`);

describe("checkProject", () => {
  it("reports a direct import of a Node.js core module", () => {
    assert.deepEqual(forFile("direct.tsx"), [
      { file: "src/components/direct.tsx", line: 3, reason: 'Node.js core module "fs"', chain: ["src/components/direct.tsx", "node:fs"] },
    ]);
  });

  it("follows path aliases and relative imports and reports the shortest chain", () => {
    assert.deepEqual(forFile("indirect.tsx"), [
      {
        file: "src/components/indirect.tsx",
        line: 3,
        reason: 'server file src/server/db.ts (matches "src/server/**")',
        chain: ["src/components/indirect.tsx", "src/lib/helper.ts", "src/server/db.ts"],
      },
    ]);
  });

  it("reports server-only packages reached through a local module", () => {
    assert.deepEqual(forFile("marker.tsx"), [
      {
        file: "src/components/marker.tsx",
        line: 2,
        reason: 'server-only package "server-only"',
        chain: ["src/components/marker.tsx", "src/lib/secret.ts", "server-only"],
      },
    ]);
  });

  it("checks dynamic imports", () => {
    assert.deepEqual(
      forFile("payments.tsx").map((finding) => finding.reason),
      ['server-only package "stripe"'],
    );
  });

  it("ignores type-only imports and re-exports, and allowed builtins", () => {
    assert.deepEqual(forFile("safe.tsx"), []);
  });

  it("stops at server actions", () => {
    assert.deepEqual(forFile("with-action.tsx"), []);
  });

  it("only treats a leading directive as a client component", () => {
    assert.deepEqual(forFile("not-client.tsx"), []);
    assert.ok(findings.every((finding) => finding.file.startsWith("src/components/")));
  });

  it("finds nothing else", () => {
    assert.equal(findings.length, 4);
  });

  it("respects ignore globs", () => {
    const ignored = checkProject({ root, config: { ...config, ignore: ["src/components/**"] } });
    assert.deepEqual(ignored, []);
  });

  it("without serverFiles, a local database module is only caught through its package", () => {
    const loose = checkProject({ root, config: { allowedBuiltins: ["events"] } });
    const indirect = loose.filter((finding) => finding.file === "src/components/indirect.tsx");
    assert.deepEqual(indirect[0]?.chain, ["src/components/indirect.tsx", "src/lib/helper.ts", "src/server/db.ts", "pg"]);
  });
});
