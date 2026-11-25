# next-client-boundary

**Fails CI when a Next.js `"use client"` component imports server-only code – directly or through other modules.**

```text
✗ src/components/indirect.tsx:3
  Client component reaches server file src/server/db.ts (matches "src/server/**")
  src/components/indirect.tsx → src/lib/helper.ts → src/server/db.ts
```

[![CI](https://github.com/tmh9x/next-client-boundary/actions/workflows/ci.yml/badge.svg)](https://github.com/tmh9x/next-client-boundary/actions/workflows/ci.yml)
![license](https://img.shields.io/badge/license-MIT-blue)

## Why

In the App Router, everything a client component imports ends up in the browser bundle. A database client, a secret or `node:fs` three imports away from a `"use client"` file either breaks the build with a vague error or – worse – ships code to the browser that was never meant to leave the server.

The [`server-only`](https://www.npmjs.com/package/server-only) package catches this at build time, but only for modules you remember to mark. `next-client-boundary` checks the whole import graph in CI and tells you **which import chain** crosses the boundary, so you can fix it in one look. It is especially useful when AI coding agents write a lot of your code: the rule is checked by a machine, not by memory.

## What it checks

For every file that starts with `"use client"`, it follows the imports breadth first and reports the **shortest chain** to:

- **Node.js core modules** (`fs`, `node:crypto`, `child_process`, …)
- **Server-only packages** – a sensible default list (`server-only`, `pg`, `@prisma/client`, `drizzle-orm/node-postgres`, `stripe`, `resend`, `nodemailer`, `bcrypt`, `@aws-sdk/*`, …), extendable
- **Your own server files**, matched by globs such as `src/server/**`

It understands how Next.js and TypeScript actually behave:

- **`"use server"` modules end the walk.** Next.js replaces their import in client code with a reference to the server action, so whatever they import stays on the server.
- **Type-only imports are ignored** (`import type`, `import { type X }`, `export type … from`) – TypeScript erases them.
- **Imports are resolved like TypeScript does**, using your `tsconfig.json`/`jsconfig.json`: path aliases (`@/*`), `baseUrl`, extensions and index files.
- **Dynamic `import()` and `require()`** are checked too.

## Install

```bash
npm install --save-dev github:tmh9x/next-client-boundary
```

Requires Node.js 20.12+ and uses the `typescript` package your project already has.

## Usage

```bash
npx next-client-boundary            # check the current directory
npx next-client-boundary apps/web   # check another project root
npx next-client-boundary --json     # machine-readable output
```

Exit codes: `0` no problems · `1` problems found · `2` usage or config error.

Add it to CI, e.g. GitHub Actions:

```yaml
- run: npx next-client-boundary
```

## Configuration

Optional `client-boundary.config.json` in the project root (or pass `--config <file>`):

```json
{
  "serverFiles": ["src/server/**", "src/lib/db.ts"],
  "extraServerPackages": ["@my-org/db"],
  "allowedBuiltins": ["events"],
  "ignore": ["src/**/*.stories.tsx"]
}
```

| Option | Meaning |
|:--|:--|
| `serverFiles` | Globs (relative to the root) of your server-only files. `**` spans folders, `*` stays in one. |
| `extraServerPackages` | Packages added to the default list. `"pkg"` also matches `pkg/sub`; `"@scope/*"` matches a whole scope. |
| `serverPackages` | Replaces the default list entirely. |
| `allowedBuiltins` | Node.js core modules client code may use (for example ones you polyfill). |
| `ignore` | Globs of files to skip completely. |

## API

```ts
import { checkProject, formatFindings } from "next-client-boundary";

const findings = checkProject({ root: "apps/web", config: { serverFiles: ["src/server/**"] } });
console.log(formatFindings(findings));
```

Each finding has the client `file`, the `line` of the import that starts the chain, the `reason` and the full `chain`.

## Limits

- It is a static check: imports built from variables (`import(name)`) cannot be followed.
- A package that is not on the server list is treated as client-safe; the walk does not go into `node_modules`.
- Server-only code in a file that is *not* matched by `serverFiles` is only caught through what that file imports (for example `pg`). Add your server folders to `serverFiles` for the clearest messages.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

## Background

This check started as rule G-06 of the Architecture Guard in [jumpra](https://github.com/tmh9x/jumpra-showcase), a Next.js SaaS starter kit for teams that build with AI coding agents. This package is a standalone, configurable version for any Next.js project.

## License

[MIT](LICENSE) © Thomas Hermanu
