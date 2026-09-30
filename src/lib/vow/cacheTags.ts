// The Next Data Cache tags on every DB2 and DB3 read (MC-010, MC-017). Constants only: any file
// may name a tag to drop it (a sync, a compute, /api/revalidate), but only src/lib/vow/door.ts
// opens a connection that carries one.
export const DB_CACHE_TAG = { SOLD_DATABASE_URL: "db2", ANALYTICS_DATABASE_URL: "db3" } as const;
