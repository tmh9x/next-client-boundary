"use client";
import { saveName } from "@/app/actions";

export function WithAction() {
  return <button onClick={() => saveName("x")}>Save</button>;
}
