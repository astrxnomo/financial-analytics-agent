import postgres from "postgres";

let client: ReturnType<typeof postgres> | null = null;

export function db() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set.");
    client = postgres(url);
  }
  return client;
}
