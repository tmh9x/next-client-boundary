"use server";
import { pool } from "@/server/db";

export async function saveName(name: string) {
  await pool.query("insert into users(name) values ($1)", [name]);
}
