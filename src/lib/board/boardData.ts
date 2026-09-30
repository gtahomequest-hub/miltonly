// src/lib/board/boardData.ts — read side. Reads the precomputed analytics.board_stats
// (DB3). Returns null if unavailable. Never touches DB2 or raw records. MC-046: the Board left
// the visitor view; a reader holds a VowAccess from the door, so the Board returns gated in Stage 2.
import { analyticsDb, type VowAccess } from "@/lib/vow/door";
import type { BoardTab } from "./computeBoard";

const ORDER = ["overall", "detached", "townhouse", "semi", "condo"];

export async function getBoardData(access: VowAccess): Promise<BoardTab[] | null> {
  const a = analyticsDb(access);
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
