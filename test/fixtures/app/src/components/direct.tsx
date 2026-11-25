/* A client component that reads a file - wrong. */
"use client";
import { readFileSync } from "node:fs";

export function Direct() {
  return <p>{readFileSync("x", "utf8")}</p>;
}
