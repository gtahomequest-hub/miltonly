// One consumer's record and audit trail, producible on demand for PropTx (MP-007, MLS® Rule
// 8.06 / 8.08, Appendix B(b), VOW Best Practices item 28). Appendix B(b) obliges the Member to
// keep, and produce on request, "the name, email address, username, and current password of
// each Consumer" plus the audit trail. The password is a bcrypt hash, never plaintext, so what
// is produced is the password RECORD: the hashing scheme, the set date, the expiry, and the
// fact that the consumer proved it at each sign-in.
//
// THE FIELD NAMES ARE HOMESLY'S. This report is shaped column-for-column against
// D:\homesly src/lib/vow/audit-report.ts, so one PropTx request gets one format from both
// sites. Where the portal has no equivalent of a Homesly field, the column is present and left
// blank rather than dropped (email_verified_at, session_id), and it is never fabricated. The
// portal stores the raw IP where Homesly stores a hash; it goes in the ip_hash column so the
// two files parse the same, and the report notes it.
//
// PURE: no Prisma, no server-only. The DB query lives in consumer-report-db.ts (the site) and
// is replicated in scripts/export-vow-access-log.ts (a shell), both feeding buildConsumerReport
// the rows they read, so the site and the shell produce byte-identical CSVs.

import { hashSchemeOf, PASSWORD_HELD_AS, passwordExpiresAt, credentialRetainUntil } from "@/lib/portal/passwordRule";
import { REVIEW_FLAG } from "@/lib/vow-access";

/** One line of the trail: a read, an agreement, or a throttle. */
export interface ConsumerEvent {
  at: Date;
  /** "read", "terms_agreed" or "throttled". */
  kind: string;
  /** What it was about. */
  detail: string;
  ip: string | null;
  userAgent: string | null;
}

/** The per-consumer record: the account facts, then the trail. */
export interface ConsumerReport {
  consumer: {
    id: string;
    email: string;
    name: string | null;
    createdAt: Date;
    /** The portal does not timestamp email verification; null (never fabricated). */
    emailVerifiedAt: Date | null;
    /** When the account was anonymised on an erasure request (MP-007); null otherwise. */
    disabledAt: Date | null;
    /** When a hold was placed (registrant or reviewer); null when not held. */
    heldAt: Date | null;
    termsAcceptedAt: Date | null;
    termsVersion: number | null;
    passwordSetAt: Date | null;
    passwordExpiresAt: Date | null;
    /** Appendix B(b): the record may not be deleted before this date. */
    retainUntil: Date | null;
    /** The hashing scheme held in place of the password, by name (bcrypt). Never the hash. */
    passwordScheme: string | null;
    /** What is held in place of the password, in words. Null with no password. */
    passwordHeldAs: string | null;
  };
  range: { from: Date | null; to: Date | null };
  events: ConsumerEvent[];
  counts: { reads: number; agreements: number; throttles: number };
}

/** The account row a report is built from (the columns consumer-report-db.ts and the shell select). */
export interface ConsumerRow {
  id: string;
  email: string;
  firstName: string | null;
  createdAt: Date;
  erasureRequestedAt: Date | null;
  reviewFlag: string | null;
  reviewFlaggedAt: Date | null;
  vowAcknowledgedAt: Date | null;
  vowAcknowledgementVersion: number | null;
  passwordHash: string | null;
  passwordSetAt: Date | null;
}

export interface ConsumerTrail {
  access: Array<{ at: Date; kind: string; scope: string | null; path: string | null; recordCount: number; ip: string | null; userAgent: string | null }>;
  consents: Array<{ at: Date; version: number; ip: string | null; userAgent: string | null }>;
  throttles: Array<{ at: Date; limit: string; count: number; max: number; ip: string | null }>;
}

/**
 * Assemble the report from already-fetched rows. Pure. Both the site and the shell call this,
 * so their CSVs cannot drift.
 * @param user - the account row.
 * @param trail - the access, consent and throttle rows.
 * @param range - the window the caller applied (for the header), either bound absent.
 * @returns the report.
 */
export function buildConsumerReport(user: ConsumerRow, trail: ConsumerTrail, range: { from?: Date; to?: Date } = {}): ConsumerReport {
  const events: ConsumerEvent[] = [];
  for (const r of trail.access) {
    events.push({
      at: r.at,
      kind: "read",
      detail: `${r.kind} ${r.scope ?? ""} on ${r.path ?? ""}; records ${r.recordCount}`.replace(/\s+/g, " ").trim(),
      ip: r.ip,
      userAgent: r.userAgent,
    });
  }
  for (const c of trail.consents) {
    events.push({ at: c.at, kind: "terms_agreed", detail: `terms version ${c.version}`, ip: c.ip, userAgent: c.userAgent });
  }
  for (const t of trail.throttles) {
    events.push({ at: t.at, kind: "throttled", detail: `${t.limit} ${t.count}/${t.max}`, ip: t.ip, userAgent: null });
  }
  events.sort((a, b) => a.at.getTime() - b.at.getTime());

  const held = user.reviewFlag === REVIEW_FLAG.reviewerHeld || user.reviewFlag === REVIEW_FLAG.registrant;

  return {
    consumer: {
      id: user.id,
      email: user.email,
      name: user.firstName,
      createdAt: user.createdAt,
      emailVerifiedAt: null,
      disabledAt: user.erasureRequestedAt,
      heldAt: held ? user.reviewFlaggedAt : null,
      termsAcceptedAt: user.vowAcknowledgedAt,
      termsVersion: user.vowAcknowledgementVersion,
      passwordSetAt: user.passwordSetAt,
      passwordExpiresAt: passwordExpiresAt(user.passwordSetAt),
      retainUntil: credentialRetainUntil(user.passwordSetAt),
      passwordScheme: hashSchemeOf(user.passwordHash),
      passwordHeldAs: user.passwordHash ? PASSWORD_HELD_AS : null,
    },
    range: { from: range.from ?? null, to: range.to ?? null },
    events,
    counts: {
      reads: events.filter((e) => e.kind === "read").length,
      agreements: events.filter((e) => e.kind === "terms_agreed").length,
      throttles: events.filter((e) => e.kind === "throttled").length,
    },
  };
}

/** The columns consumer-report-db.ts and the shell select from User, in one place. */
export const CONSUMER_ROW_SELECT = {
  id: true,
  email: true,
  firstName: true,
  createdAt: true,
  erasureRequestedAt: true,
  reviewFlag: true,
  reviewFlaggedAt: true,
  vowAcknowledgedAt: true,
  vowAcknowledgementVersion: true,
  passwordHash: true,
  passwordSetAt: true,
} as const;

/** One CSV cell: quoted, doubling quotes, and a formula-shaped cell neutralised (as the trail
 *  export does). */
function cell(v: unknown): string {
  let s = v instanceof Date ? v.toISOString() : v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The consumer record's header columns, in Homesly's order (audit-report.ts). */
export const CONSUMER_HEADER = [
  "consumer_id",
  "email",
  "name",
  "created_at",
  "email_verified_at",
  "disabled_at",
  "held_at",
  "terms_accepted_at",
  "terms_version",
  "password_set_at",
  "password_expires_at",
  "retain_until",
  "password_scheme",
  "password_held_as",
] as const;

/** The event columns, in Homesly's order. ip_hash carries the portal's stored IP (see the file header). */
export const CONSUMER_EVENT_HEADER = ["at", "kind", "detail", "ip_hash", "user_agent", "session_id"] as const;

/**
 * The report as CSV: the account header block, a blank line, then one row per event. Matches
 * Homesly's auditReportCsv column-for-column.
 * @param r - the report.
 * @returns the text.
 */
export function consumerReportCsv(r: ConsumerReport): string {
  const c = r.consumer;
  const head = [
    CONSUMER_HEADER.join(","),
    [
      c.id,
      c.email,
      c.name,
      c.createdAt,
      c.emailVerifiedAt,
      c.disabledAt,
      c.heldAt,
      c.termsAcceptedAt,
      c.termsVersion,
      c.passwordSetAt,
      c.passwordExpiresAt,
      c.retainUntil,
      c.passwordScheme,
      c.passwordHeldAs,
    ]
      .map(cell)
      .join(","),
    "",
    CONSUMER_EVENT_HEADER.join(","),
  ];
  const rows = r.events.map((e) => [e.at, e.kind, e.detail, e.ip, e.userAgent, ""].map(cell).join(","));
  return [...head, ...rows].join("\n") + "\n";
}
