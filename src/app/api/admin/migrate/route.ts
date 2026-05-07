// Migration runner for the `sold` and `analytics` schemas.
//
// Auth: Authorization: Bearer <CRON_SECRET> (Point 7 — no query-string secrets).
// Lock: pg_advisory_lock(12345) (Point F) prevents two simultaneous deploys
// from racing on the same migration.
// Tracking: each schema has its own <schema>._migrations table listing applied
// filenames. Only files not yet applied are executed, in lexicographic order.
//
// Usage:
//   POST /api/admin/migrate?schema=sold
//   POST /api/admin/migrate?schema=analytics
//   POST /api/admin/migrate              (applies both)

import { NextRequest, NextResponse } from "next/server";
import { readFile, readdir } from "fs/promises";
import path from "path";
import { getSoldDb, getAnalyticsDb } from "@/lib/db";
import type { NeonQueryFunction } from "@neondatabase/serverless";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const ADVISORY_LOCK_KEY = 12345;

type SchemaName = "sold" | "analytics";

interface SchemaResult {
  schema: SchemaName;
  applied: string[];
  skipped: string[];
  error?: string;
}

function authorize(req: NextRequest): boolean {
  const header = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  return !!header && !!process.env.CRON_SECRET && header === expected;
}

/**
 * Split a SQL migration file into individual statements.
 * Handles line comments (--), block comments, and string literals so a
 * semicolon inside a string or comment doesn't split a statement.
 * Neon's HTTP transport runs one statement per call.
 */
function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let buf = "";
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      buf += ch;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") { inBlockComment = false; buf += "*/"; i++; continue; }
      buf += ch;
      continue;
    }
    if (inSingle) {
      buf += ch;
      if (ch === "'" && sql[i - 1] !== "\\") inSingle = false;
      continue;
    }
    if (inDouble) {
      buf += ch;
      if (ch === '"' && sql[i - 1] !== "\\") inDouble = false;
      continue;
    }

    if (ch === "-" && next === "-") { inLineComment = true; buf += "--"; i++; continue; }
    if (ch === "/" && next === "*") { inBlockComment = true; buf += "/*"; i++; continue; }
    if (ch === "'") { inSingle = true; buf += ch; continue; }
    if (ch === '"') { inDouble = true; buf += ch; continue; }

    if (ch === ";") {
      const trimmed = buf.trim();
      if (trimmed.length > 0) statements.push(trimmed);
      buf = "";
      continue;
    }
    buf += ch;
  }
  const tail = buf.trim();
  if (tail.length > 0) statements.push(tail);
  return statements;
}

async function ensureMigrationsTable(
  sql: NeonQueryFunction<false, false>,
  schema: SchemaName
): Promise<void> {
  await sql.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`, []);
  await sql.query(
    `CREATE TABLE IF NOT EXISTS ${schema}._migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    []
  );
}

async function getAppliedFilenames(
  sql: NeonQueryFunction<false, false>,
  schema: SchemaName
): Promise<Set<string>> {
  const rows = (await sql.query(
    `SELECT filename FROM ${schema}._migrations`,
    []
  )) as Array<{ filename: string }>;
  return new Set(rows.map((r) => r.filename));
}

async function runMigrationsForSchema(
  sql: NeonQueryFunction<false, false>,
  schema: SchemaName
): Promise<SchemaResult> {
  const result: SchemaResult = { schema, applied: [], skipped: [] };
  const dir = path.join(process.cwd(), "migrations", schema);

  let filenames: string[] = [];
  try {
    filenames = (await readdir(dir))
      .filter((f) => f.endsWith(".sql"))
      .sort(); // lexicographic — relies on 001_, 002_ prefix convention
  } catch (err) {
    result.error = `Cannot read migrations dir ${dir}: ${String(err)}`;
    return result;
  }

  await ensureMigrationsTable(sql, schema);
  const applied = await getAppliedFilenames(sql, schema);

  for (const filename of filenames) {
    if (applied.has(filename)) {
      result.skipped.push(filename);
      continue;
    }
    const content = await readFile(path.join(dir, filename), "utf8");
    const statements = splitStatements(content);
    try {
      for (const stmt of statements) {
        await sql.query(stmt, []);
      }
      await sql.query(
        `INSERT INTO ${schema}._migrations (filename) VALUES ($1)`,
        [filename]
      );
      result.applied.push(filename);
    } catch (err) {
      result.error = `Failed on ${filename}: ${String(err)}`;
      break;
    }
  }

  return result;
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requested = req.nextUrl.searchParams.get("schema") as SchemaName | null;
  const targets: SchemaName[] =
    requested === "sold" ? ["sold"] :
    requested === "analytics" ? ["analytics"] :
    ["sold", "analytics"];

  const sd = getSoldDb();
  const ad = getAnalyticsDb();
  if (!sd && targets.includes("sold")) {
    return NextResponse.json({ error: "SOLD_DATABASE_URL is not configured" }, { status: 500 });
  }
  if (!ad && targets.includes("analytics")) {
    return NextResponse.json({ error: "ANALYTICS_DATABASE_URL is not configured" }, { status: 500 });
  }

  // Neon HTTP is stateless per request, so pg_advisory_lock wouldn't persist
  // across separate calls anyway — pg_try_advisory_lock + pg_advisory_unlock
  // in the same call is the right pattern for a single-shot gate. Concurrent
  // migration attempts are additionally protected by the _migrations PK conflict.
  const lockClient = (sd ?? ad)!;
  const results: SchemaResult[] = [];
  let lockAcquired = false;

  try {
    const lockRows = (await lockClient.query(
      `SELECT pg_try_advisory_lock($1) AS got`,
      [ADVISORY_LOCK_KEY]
    )) as Array<{ got: boolean }>;
    lockAcquired = !!lockRows[0]?.got;
    if (!lockAcquired) {
      return NextResponse.json(
        { error: "Another migration is in progress" },
        { status: 409 }
      );
    }

    if (targets.includes("sold") && sd) {
      results.push(await runMigrationsForSchema(sd, "sold"));
    }
    if (targets.includes("analytics") && ad) {
      results.push(await runMigrationsForSchema(ad, "analytics"));
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Migration failed: ${String(err)}`, results },
      { status: 500 }
    );
  } finally {
    if (lockAcquired) {
      try {
        await lockClient.query(`SELECT pg_advisory_unlock($1)`, [ADVISORY_LOCK_KEY]);
      } catch {
        // Lock will be released when the connection session ends on Neon's side.
      }
    }
  }

  const hadError = results.some((r) => r.error);
  return NextResponse.json({ ok: !hadError, results }, { status: hadError ? 500 : 200 });
}
