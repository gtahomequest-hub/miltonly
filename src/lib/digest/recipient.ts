import "server-only";

// The desk's digest watch: the row the digest's unsubscribe link disables.
//
// Every other recurring email is addressed to a SavedSearch row, and the one-click unsubscribe
// (src/lib/email/unsubscribe.ts) signs that row's id. The digest had no row, because its
// recipient is an environment variable and not a signup. So the sender finds or creates one
// of kind "digest" per (address, environment), and reads `alertEnabled` off it before every
// send. Unsubscribing from the digest disables that row and nothing else; re-enabling it is a
// one-row update, and a re-run creates nothing new.
//
// It is not a listing watch and not a brief: /api/alerts/match and /api/brief/send both
// exclude the kind by name.

import { prisma } from "@/lib/prisma";
import type { LeadEnv } from "@/lib/lead/env";

export interface DigestWatch {
  id: string;
  alertEnabled: boolean;
}

/** The recipient's digest watch. With `create` false (a dry run) a missing row stays missing
 *  and null comes back, so a dry run leaves no trace. */
export async function digestWatchFor(email: string, env: LeadEnv, opts: { create: boolean }): Promise<DigestWatch | null> {
  const recipient = email.trim().toLowerCase();
  const existing = await prisma.savedSearch.findFirst({
    where: { kind: "digest", email: recipient, env },
    select: { id: true, alertEnabled: true },
  });
  if (existing || !opts.create) return existing;
  return prisma.savedSearch.create({
    data: { kind: "digest", email: recipient, env, name: "Weekly leads digest" },
    select: { id: true, alertEnabled: true },
  });
}
