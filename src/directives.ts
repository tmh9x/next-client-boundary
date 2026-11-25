/**
 * Detects the Next.js "use client" / "use server" directives.
 *
 * A directive only counts when it is the first statement of the file. Comments
 * and blank lines may come before it, and other directives (for example
 * "use strict") may share the prologue.
 */

export type Directive = "use client" | "use server";

const prologue = /^(?:\s|\/\/[^\n]*\n?|\/\*[\s\S]*?\*\/)*((?:["'][^"'\n]*["']\s*;?\s*(?:\/\/[^\n]*\n?|\/\*[\s\S]*?\*\/)*\s*)+)/;
const stringLiteral = /["']([^"'\n]*)["']/g;

/** All directives in the file's prologue, in order. */
export function directivesOf(source: string): string[] {
  const match = prologue.exec(source.replace(/^﻿/, "").replace(/^#![^\n]*\n/, ""));
  if (match === null) {
    return [];
  }
  return [...(match[1] ?? "").matchAll(stringLiteral)].map((m) => m[1] ?? "");
}

export function hasDirective(source: string, directive: Directive): boolean {
  return directivesOf(source).includes(directive);
}
