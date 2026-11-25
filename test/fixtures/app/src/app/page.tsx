// Server component: may use the database.
import { pool } from "@/server/db";

export default async function Page() {
  const { rows } = await pool.query("select 1");
  return <pre>{JSON.stringify(rows)}</pre>;
}
