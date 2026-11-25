import { formatName } from "./format";
import { pool } from "../server/db";

export async function loadName(id: string) {
  const { rows } = await pool.query("select name from users where id = $1", [id]);
  return formatName(rows[0].name);
}
