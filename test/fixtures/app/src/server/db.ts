import { Pool } from "pg";

export type User = { id: string; name: string };
export const pool = new Pool();
