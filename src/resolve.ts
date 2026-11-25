import { isBuiltin } from "node:module";
import { dirname, isAbsolute, resolve, sep } from "node:path";
import ts from "typescript";

export type Resolved =
  | { kind: "builtin"; name: string }
  | { kind: "package"; name: string }
  | { kind: "local"; path: string }
  | { kind: "unresolved" };

export type Resolver = (specifier: string, fromFile: string) => Resolved;

/** "@scope/pkg/sub" -> "@scope/pkg", "pkg/sub" -> "pkg" */
export function packageNameOf(specifier: string): string {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : (parts[0] ?? specifier);
}

function isBare(specifier: string): boolean {
  return !specifier.startsWith(".") && !isAbsolute(specifier);
}

function compilerOptionsFor(root: string, tsconfigPath?: string): ts.CompilerOptions {
  const configFile = tsconfigPath ?? ts.findConfigFile(root, ts.sys.fileExists, "tsconfig.json") ?? ts.findConfigFile(root, ts.sys.fileExists, "jsconfig.json");
  let options: ts.CompilerOptions = {};
  if (configFile !== undefined && resolve(dirname(configFile)).startsWith(resolve(root))) {
    const read = ts.readConfigFile(configFile, ts.sys.readFile);
    if (read.error === undefined) {
      options = ts.parseJsonConfigFileContent(read.config, ts.sys, dirname(configFile), undefined, configFile).options;
    }
  }
  return {
    ...options,
    allowJs: true,
    jsx: options.jsx ?? ts.JsxEmit.Preserve,
    module: options.module ?? ts.ModuleKind.ESNext,
    moduleResolution: options.moduleResolution ?? ts.ModuleResolutionKind.Bundler,
    // Resolve to source files, never to .d.ts stubs of local code.
    noDtsResolution: false,
  };
}

/**
 * Resolves module specifiers the way TypeScript does, using the project's
 * tsconfig.json or jsconfig.json (paths, baseUrl, moduleResolution).
 */
export function createResolver(root: string, tsconfigPath?: string): Resolver {
  const options = compilerOptionsFor(root, tsconfigPath);
  const cache = ts.createModuleResolutionCache(root, (name) => name, options);
  const nodeModules = `${sep}node_modules${sep}`;

  return (specifier, fromFile) => {
    if (isBuiltin(specifier)) {
      return { kind: "builtin", name: specifier.replace(/^node:/, "") };
    }
    const result = ts.resolveModuleName(specifier, fromFile, options, ts.sys, cache).resolvedModule;
    if (result !== undefined) {
      const path = resolve(result.resolvedFileName);
      if (!result.isExternalLibraryImport && !path.includes(nodeModules) && !path.endsWith(".d.ts")) {
        return { kind: "local", path };
      }
      if (isBare(specifier)) {
        return { kind: "package", name: packageNameOf(specifier) };
      }
    }
    if (isBare(specifier)) {
      // Not installed (or only types) - still a package reference.
      return { kind: "package", name: packageNameOf(specifier) };
    }
    return { kind: "unresolved" };
  };
}
