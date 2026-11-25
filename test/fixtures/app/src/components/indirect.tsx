"use client";
import { useState } from "react";
import { loadName } from "@/lib/helper";

export function Indirect() {
  const [name] = useState(() => loadName("1"));
  return <p>{String(name)}</p>;
}
