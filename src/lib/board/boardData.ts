// src/lib/board/boardData.ts — read side. Reads the precomputed analytics.board_stats
// (DB3) for the homepage Board. Returns null if unavailable (graceful: the Board
// section then doesn't render). Never touches DB2 or raw records.
import { getAnalyticsDb } from "@/lib/db";
import type { BoardTab } from "./computeBoard";

const ORDER = ["overall", "detached", "townhouse", "semi", "condo"];

export async function getBoardData(): Promise<BoardTab[] | null> {
  const a = getAnalyticsDb();
  if (!a) return null;
  try {
    const rows = (await a`SELECT tab, data FROM analytics.board_stats`) as Array<{ tab: string; data: BoardTab }>;
    if (!rows.length) return null;
    return rows
      .map((r) => r.data) // neon returns jsonb pre-parsed
      .sort((x, y) => ORDER.indexOf(x.tab) - ORDER.indexOf(y.tab));
  } catch {
    return null;
  }
}
