// OFFLINE ONLY (MC-046). The DB2 and DB3 clients for scripts under scripts/, which run on a
// developer's machine and never in a page or route. The app opens DB2 and DB3 only through
// src/lib/vow/door.ts, and scripts/test-vow-door.ts fails the build if anything under src/
// imports this file or reads the connection strings itself.
//
// A script that calls a src/ library which reads through the door's scope (the generators, the
// computes) enters the scope instead: withVowAccess(vowScriptAccess(), () => ...), run under
// `tsx --require ./scripts/_server-only-shim.cjs`.
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

type Sql = NeonQueryFunction<false, false>;
const clients: Record<string, Sql | null> = {};
function client(key: "SOLD_DATABASE_URL" | "ANALYTICS_DATABASE_URL"): Sql | null {
  if (!(key in clients)) clients[key] = process.env[key] ? neon(process.env[key] as string) : null;
  return clients[key];
}

export const getSoldDb = (): Sql | null => client("SOLD_DATABASE_URL");
export const getAnalyticsDb = (): Sql | null => client("ANALYTICS_DATABASE_URL");
export const requireSoldDb = (): Sql => {
  const db = getSoldDb();
  if (!db) throw new Error("SOLD_DATABASE_URL is not configured");
  return db;
};
export const requireAnalyticsDb = (): Sql => {
  const db = getAnalyticsDb();
  if (!db) throw new Error("ANALYTICS_DATABASE_URL is not configured");
  return db;
};
