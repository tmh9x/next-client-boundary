#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { checkProject } from "./check.js";
import { formatFindings } from "./format.js";
import type { Config } from "./rules.js";

const help = `Usage: next-client-boundary [root] [options]

Fails when a "use client" component imports server-only code,
directly or through other local modules.

Options:
  --config <file>    Config file (default: <root>/client-boundary.config.json)
  --tsconfig <file>  tsconfig/jsconfig to resolve imports with (default: found in <root>)
  --json             Print findings as JSON
  -h, --help         Show this help

Exit codes: 0 no problems, 1 problems found, 2 usage or config error.`;

function loadConfig(path: string, explicit: boolean): Config {
  if (!existsSync(path)) {
    if (explicit) {
      throw new Error(`Config file not found: ${path}`);
    }
    return {};
  }
  return JSON.parse(readFileSync(path, "utf8")) as Config;
}

function main(argv: string[]): number {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        config: { type: "string" },
        tsconfig: { type: "string" },
        json: { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
    });
  } catch (error) {
    console.error(`${(error as Error).message}\n\n${help}`);
    return 2;
  }
  const { values, positionals } = parsed;
  if (values.help) {
    console.log(help);
    return 0;
  }

  const root = resolve(positionals[0] ?? ".");
  try {
    const config = loadConfig(resolve(root, values.config ?? "client-boundary.config.json"), values.config !== undefined);
    const findings = checkProject({ root, config, tsconfig: values.tsconfig === undefined ? undefined : resolve(values.tsconfig) });
    console.log(values.json ? JSON.stringify(findings, null, 2) : formatFindings(findings));
    return findings.length === 0 ? 0 : 1;
  } catch (error) {
    console.error(`next-client-boundary: ${(error as Error).message}`);
    return 2;
  }
}

process.exitCode = main(process.argv.slice(2));
