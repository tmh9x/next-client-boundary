import type { Finding } from "./check.js";

export const fixHint =
  "Keep server work on the server: call it from a server component and pass the result as props, " +
  'or move it into a server action ("use server") and import that.';

export function formatFindings(findings: readonly Finding[]): string {
  if (findings.length === 0) {
    return "✓ No client component reaches server-only code.";
  }
  const lines = findings.map(
    (finding) => `✗ ${finding.file}:${finding.line}\n  Client component reaches ${finding.reason}\n  ${finding.chain.join(" → ")}`,
  );
  const count = findings.length === 1 ? "1 problem" : `${findings.length} problems`;
  return `${lines.join("\n\n")}\n\n${count}. ${fixHint}`;
}
