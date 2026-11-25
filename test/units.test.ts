import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { directivesOf, hasDirective } from "../src/directives.js";
import { importsOf } from "../src/imports.js";
import { packageNameOf } from "../src/resolve.js";
import { createRules, globToRegExp, matchesPackage } from "../src/rules.js";

describe("directives", () => {
  it("finds a leading directive after comments", () => {
    assert.ok(hasDirective('// header\n/* block */\n"use client";\nimport x from "y";', "use client"));
    assert.ok(hasDirective("'use client'\nexport {}", "use client"));
  });

  it("reads every directive of the prologue", () => {
    assert.deepEqual(directivesOf('"use strict";\n"use server";\nexport {}'), ["use strict", "use server"]);
  });

  it("ignores strings that are not in the prologue", () => {
    assert.equal(hasDirective('import x from "y";\n"use client";', "use client"), false);
    assert.equal(hasDirective('const mode = "use client";', "use client"), false);
  });
});

describe("importsOf", () => {
  const source = [
    'import a from "a";',
    'import type { B } from "b";',
    'import { type C } from "c";',
    'import { type D, d } from "d";',
    'import "e";',
    'export * from "f";',
    'export type { G } from "g";',
    'const h = await import("h");',
    'const i = require("i");',
    'type J = import("j").J;',
  ].join("\n");

  it("collects every module reference with its line", () => {
    assert.deepEqual(importsOf("x.ts", source), [
      { specifier: "a", typeOnly: false, line: 1 },
      { specifier: "b", typeOnly: true, line: 2 },
      { specifier: "c", typeOnly: true, line: 3 },
      { specifier: "d", typeOnly: false, line: 4 },
      { specifier: "e", typeOnly: false, line: 5 },
      { specifier: "f", typeOnly: false, line: 6 },
      { specifier: "g", typeOnly: true, line: 7 },
      { specifier: "h", typeOnly: false, line: 8 },
      { specifier: "i", typeOnly: false, line: 9 },
    ]);
  });

  it("parses JSX", () => {
    assert.deepEqual(importsOf("x.tsx", 'import X from "x";\nexport const Y = () => <X />;').map((ref) => ref.specifier), ["x"]);
  });
});

describe("rules", () => {
  it("matches packages, subpaths and scopes", () => {
    assert.ok(matchesPackage("stripe", "stripe"));
    assert.ok(matchesPackage("stripe/lib/x", "stripe"));
    assert.equal(matchesPackage("stripe-js", "stripe"), false);
    assert.ok(matchesPackage("@aws-sdk/client-s3", "@aws-sdk/*"));
  });

  it("turns globs into regular expressions", () => {
    assert.ok(globToRegExp("src/server/**").test("src/server/a/b.ts"));
    assert.ok(globToRegExp("**/db.ts").test("db.ts"));
    assert.ok(globToRegExp("**/db.ts").test("src/lib/db.ts"));
    assert.equal(globToRegExp("src/*.ts").test("src/a/b.ts"), false);
    assert.equal(globToRegExp("lib/db.ts").test("lib/dbxts"), false);
  });

  it("uses defaults, extra packages and allowed builtins", () => {
    const rules = createRules({ extraServerPackages: ["my-db"], allowedBuiltins: ["node:events"] });
    assert.ok(rules.serverPackage("pg"));
    assert.ok(rules.serverPackage("my-db/client"));
    assert.equal(rules.serverPackage("react"), undefined);
    assert.equal(rules.serverBuiltin("events"), undefined);
    assert.ok(rules.serverBuiltin("fs"));
  });

  it("replaces the defaults with serverPackages", () => {
    const rules = createRules({ serverPackages: ["only-this"] });
    assert.equal(rules.serverPackage("pg"), undefined);
    assert.ok(rules.serverPackage("only-this"));
  });

  it("derives package names", () => {
    assert.equal(packageNameOf("@scope/pkg/sub/path"), "@scope/pkg");
    assert.equal(packageNameOf("pkg/sub"), "pkg");
  });
});
