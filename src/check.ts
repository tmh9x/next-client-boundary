import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { hasDirective } from "./directives.js";
import { importsOf, type ImportRef } from "./imports.js";
import { createResolver, type Resolved, type Resolver } from "./resolve.js";
import { createRules, type Config, type Rules } from "./rules.js";

export interface Finding {
  /** The client component, relative to the root. */
  file: string;
  /** Line of the import in `file` that starts the chain. */
  line: number;
  /** What was reached, e.g. 'Node.js core module "fs"'. */
  reason: string;
  /** Files from the client component to the last local file, then the server module. */
  chain: string[];
}

export interface CheckOptions {
  /** Project root (where tsconfig.json usually lives). */
  root: string;
  config?: Config;
  /** Explicit tsconfig/jsconfig path; found automatically otherwise. */
  tsconfig?: string;
}

const sourceFile = /\.(?:[cm]?[jt]sx?)$/;
const skippedDirectories = new Set(["node_modules", ".next", ".git", "dist", "build", "out", "coverage", ".turbo", ".vercel"]);

function toPosix(path: string): string {
  return sep === "/" ? path : path.split(sep).join("/");
}

/** Every source file below `root`, skipping build output and dependencies. */
export function sourceFiles(root: string): string[] {
  const files: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!skippedDirectories.has(entry.name)) {
          walk(join(directory, entry.name));
        }
      } else if (entry.isFile() && sourceFile.test(entry.name) && !entry.name.endsWith(".d.ts")) {
        files.push(join(directory, entry.name));
      }
    }
  };
  walk(root);
  return files.sort();
}

interface Edge {
  ref: ImportRef;
  target: Resolved;
}

/** Why a resolved import is server-only, or undefined. */
function serverReason(target: Resolved, specifier: string, rules: Rules, rel: (path: string) => string): string | undefined {
  switch (target.kind) {
    case "builtin":
      return rules.serverBuiltin(target.name);
    case "package":
      return rules.serverPackage(specifier);
    case "local":
      return rules.serverFile(rel(target.path));
    case "unresolved":
      return undefined;
  }
}

/**
 * Finds client components ("use client") that import server-only code, either
 * directly or through other local modules. The walk is breadth first, so each
 * finding shows the shortest import chain.
 *
 * - Type-only imports are ignored: TypeScript erases them.
 * - A "use server" module ends the walk: Next.js replaces its import in client
 *   code with a reference to the server action, so its imports stay on the server.
 */
export function checkProject(options: CheckOptions): Finding[] {
  const root = resolve(options.root);
  const rules = createRules(options.config);
  const resolver: Resolver = createResolver(root, options.tsconfig);
  const rel = (path: string) => toPosix(relative(root, path));

  const sources = new Map<string, string>();
  const read = (file: string): string => {
    let text = sources.get(file);
    if (text === undefined) {
      try {
        text = readFileSync(file, "utf8");
      } catch {
        text = "";
      }
      sources.set(file, text);
    }
    return text;
  };

  const edges = new Map<string, Edge[]>();
  const edgesOf = (file: string): Edge[] => {
    let list = edges.get(file);
    if (list === undefined) {
      list = importsOf(file, read(file))
        .filter((ref) => !ref.typeOnly)
        .map((ref) => ({ ref, target: resolver(ref.specifier, file) }));
      edges.set(file, list);
    }
    return list;
  };
  const isServerAction = (file: string) => hasDirective(read(file), "use server");

  const findings: Finding[] = [];
  const clients = sourceFiles(root).filter((file) => !rules.ignored(rel(file)) && hasDirective(read(file), "use client"));

  for (const client of clients) {
    const reported = new Set<string>();
    const seen = new Set([client]);
    const queue: { file: string; chain: string[]; line: number | undefined }[] = [{ file: client, chain: [rel(client)], line: undefined }];

    while (queue.length > 0) {
      const current = queue.shift() as (typeof queue)[number];
      for (const { ref, target } of edgesOf(current.file)) {
        const line = current.line ?? ref.line;
        const reason = serverReason(target, ref.specifier, rules, rel);
        const local = target.kind === "local" ? target.path : undefined;

        if (reason !== undefined && !(local !== undefined && isServerAction(local))) {
          const key = local ?? `${target.kind}:${ref.specifier}`;
          if (!reported.has(key)) {
            reported.add(key);
            findings.push({
              file: rel(client),
              line,
              reason,
              chain: [...current.chain, local === undefined ? ref.specifier : rel(local)],
            });
          }
          continue;
        }
        if (local === undefined || seen.has(local) || rules.ignored(rel(local))) {
          continue;
        }
        seen.add(local);
        if (!isServerAction(local)) {
          queue.push({ file: local, chain: [...current.chain, rel(local)], line });
        }
      }
    }
  }
  return findings;
}
