import { readFileSync } from "node:fs";
const x = "use client";
export const notClient = () => readFileSync(x);
