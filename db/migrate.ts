import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { readFile } from "node:fs/promises";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (see .env.local).");

const sql = postgres(url, { max: 1 });

const schema = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
await sql.unsafe(schema);
console.log("Schema applied.");
await sql.end();
