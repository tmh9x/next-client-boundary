'use client'
import type { User } from "@/server/db";
import { type User as U2 } from "../server/db";
import { EventEmitter } from "events";
import { formatName } from "@/lib/format";
export type { User as U3 } from "@/server/db";

export function Safe({ user, other }: { user: User; other: U2 }) {
  new EventEmitter();
  return <p>{formatName(user.name + other.name)}</p>;
}
