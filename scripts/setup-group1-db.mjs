import { readFile } from "node:fs/promises";

const url = process.env.GROUP1_DATABASE_URL || process.env.TURSO_DATABASE_URL;
const token = process.env.GROUP1_DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;
if (!url || !token) throw new Error("Set GROUP1_DATABASE_URL and GROUP1_DATABASE_AUTH_TOKEN first");

const sql = await readFile(new URL("../sql/group1-bookings.sql", import.meta.url), "utf8");
const statements = sql.split(";").map((statement) => statement.trim()).filter(Boolean);
const httpUrl = url.replace(/^libsql:\/\//, "https://");
const response = await fetch(`${httpUrl.replace(/\/$/, "")}/v2/pipeline`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    baton: null,
    requests: [...statements.map((statement) => ({ type: "execute", stmt: { sql: statement, want_rows: false } })), { type: "close" }],
  }),
});
if (!response.ok) throw new Error(`Database returned ${response.status}: ${await response.text()}`);
const body = await response.json();
const failed = body.results?.find((result) => result.type !== "ok");
if (failed) throw new Error(failed.error?.message || "Database setup failed");
console.log("group1_bookings ready");
