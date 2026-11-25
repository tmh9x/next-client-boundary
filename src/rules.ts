export interface Config {
  /**
   * Packages that must never reach client code. An entry matches the package
   * itself and its subpaths ("stripe" matches "stripe/lib/x"); "@scope/*"
   * matches every package in a scope. Replaces the defaults when set.
   */
  serverPackages?: string[];
  /** Extra server-only packages, added to the defaults. */
  extraServerPackages?: string[];
  /**
   * Local files that are server-only, as globs relative to the project root,
   * e.g. "src/server/**" or "lib/db.ts".
   */
  serverFiles?: string[];
  /** Node.js core modules client code may import, e.g. ["events"]. */
  allowedBuiltins?: string[];
  /** Globs (relative to the root) of files to skip entirely. */
  ignore?: string[];
}

export const defaultServerPackages: readonly string[] = [
  "server-only",
  "@prisma/client",
  "drizzle-orm/node-postgres",
  "drizzle-orm/postgres-js",
  "drizzle-orm/mysql2",
  "drizzle-orm/better-sqlite3",
  "pg",
  "postgres",
  "mysql2",
  "better-sqlite3",
  "mongodb",
  "mongoose",
  "ioredis",
  "redis",
  "stripe",
  "resend",
  "nodemailer",
  "bcrypt",
  "argon2",
  "jsonwebtoken",
  "@aws-sdk/*",
];

/** Minimal glob: "**" spans directories, "*" stays within one segment. */
export function globToRegExp(glob: string): RegExp {
  let pattern = "";
  for (let index = 0; index < glob.length; index++) {
    const char = glob[index] as string;
    if (char === "*") {
      if (glob[index + 1] === "*") {
        const slash = glob[index + 2] === "/";
        pattern += slash ? "(?:.*/)?" : ".*";
        index += slash ? 2 : 1;
      } else {
        pattern += "[^/]*";
      }
    } else if (char === "?") {
      pattern += "[^/]";
    } else {
      pattern += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${pattern}$`);
}

export function matchesPackage(specifier: string, entry: string): boolean {
  if (entry.endsWith("/*")) {
    return specifier.startsWith(entry.slice(0, -1));
  }
  return specifier === entry || specifier.startsWith(`${entry}/`);
}

export interface Rules {
  /** Why a package specifier is server-only, or undefined. */
  serverPackage(specifier: string): string | undefined;
  /** Why a builtin is server-only, or undefined. */
  serverBuiltin(name: string): string | undefined;
  /** Why a local file (path relative to the root, "/" separated) is server-only, or undefined. */
  serverFile(relativePath: string): string | undefined;
  ignored(relativePath: string): boolean;
}

export function createRules(config: Config = {}): Rules {
  const packages = [...(config.serverPackages ?? defaultServerPackages), ...(config.extraServerPackages ?? [])];
  const files = (config.serverFiles ?? []).map((glob) => ({ glob, regexp: globToRegExp(glob) }));
  const ignore = (config.ignore ?? []).map(globToRegExp);
  const allowed = new Set((config.allowedBuiltins ?? []).map((name) => name.replace(/^node:/, "")));

  return {
    serverPackage(specifier) {
      const entry = packages.find((candidate) => matchesPackage(specifier, candidate));
      return entry === undefined ? undefined : `server-only package "${specifier}"`;
    },
    serverBuiltin(name) {
      return allowed.has(name) ? undefined : `Node.js core module "${name}"`;
    },
    serverFile(relativePath) {
      const match = files.find((file) => file.regexp.test(relativePath));
      return match === undefined ? undefined : `server file ${relativePath} (matches "${match.glob}")`;
    },
    ignored(relativePath) {
      return ignore.some((regexp) => regexp.test(relativePath));
    },
  };
}
