// The card's decision, as a function the prebuild can run (MP-006, from the review of 77eea1d:
// "renewal and re-consent behaviour is asserted by string includes only").
//
// planAcknowledgement() reads what the row still owes (vowStepsLeft), judges the body, and
// returns either an error or the writes to make. Nothing here touches the database: the two
// checks that need it (does the street exist, does the typed password match the old hash) are
// passed in as functions, so the route runs them live and the test runs them as stubs.
//
// The rules, in the order they are applied:
//   registrant   the answer is taken only while it is owed (isRegistrant null). Once answered
//                it is not this route's to change: a "registrant" flag is cleared by a person
//                (the schema says so), never by a second POST. A first-time "yes" is stored on
//                its own, with the name if given: no password, no agreement, no records.
//   agreement    owed when never agreed or agreed to an older version; needs the tick and, for
//                a first agreement, a name (given now or already on the row). A re-consent
//                keeps the earlier agreement: if VowConsent has no row for it yet, the old text,
//                time, IP and user agent are appended as history before the new one.
//   password     set when the row has none; renewed when it is 90 days old (the same password
//                typed again reconfirms it, a different one replaces it). Judged before anything
//                is written.

import { judgePassword } from "@/lib/portal/password";
import { VOW_ACKNOWLEDGEMENT_TEXT, VOW_TERMS_VERSION } from "@/lib/vow-acknowledgement";
import { vowStepsLeft, REVIEW_FLAG, type VowAccessFields } from "@/lib/vow-access";

// The three answers to the registrant question (MP-007). "reviewer" is the R-8.21 path: a
// PropTx or TRREB representative, held for review, not opened.
export type Declaration = "consumer" | "registrant" | "reviewer";

/** The declaration a body carries: the three-way `declaration` field when the card sends it,
 *  else the legacy boolean `isRegistrant`, else null (unanswered). */
export function readDeclaration(body: AckBody): Declaration | null {
  const d = body.declaration;
  if (d === "consumer" || d === "registrant" || d === "reviewer") return d;
  if (body.isRegistrant === true) return "registrant";
  if (body.isRegistrant === false) return "consumer";
  return null;
}

export interface AckUser extends VowAccessFields {
  id: string;
  email: string;
  firstName: string | null;
  vowAcknowledgementText: string | null;
  vowAcknowledgementIp: string | null;
  vowAcknowledgementUserAgent: string | null;
  reviewFlaggedAt: Date | null;
}

export interface AckBody {
  firstName?: unknown;
  homeStreetSlug?: unknown;
  consent?: unknown;
  password?: unknown;
  isRegistrant?: unknown;
  /** MP-007: "consumer" | "registrant" | "reviewer"; the card sends this, older callers the boolean above. */
  declaration?: unknown;
}

export interface AckOps {
  /** the registry slug, or null when the registry does not know it */
  streetExists: (slug: string) => Promise<boolean>;
  /** bcrypt compare against the row's current hash */
  passwordMatches: (password: string) => Promise<boolean>;
}

export interface AckContext {
  ip: string;
  userAgent: string;
  now: Date;
}

export type PasswordAction = { kind: "none" } | { kind: "set"; password: string } | { kind: "reconfirm" } | { kind: "replace"; password: string };

export interface ConsentRow {
  version: number;
  text: string;
  at: Date;
  ip: string | null;
  userAgent: string | null;
}

export type AckPlan =
  | { ok: false; status: number; error: string }
  | {
      ok: true;
      firstName: string | null;
      homeStreetSlug: string | null;
      registrant: { isRegistrant: boolean; flag: boolean } | null;
      /** MP-007: the reviewer answer (R-8.21). The route sets the reviewer-hold flag and emails the owner. */
      reviewer: boolean;
      agreement: boolean;
      /** the history rows to append, in order: the prior agreement (once) then the new one */
      consents: ConsentRow[];
      password: PasswordAction;
    };

export function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const n = raw
    .split("")
    .filter((ch) => ch.charCodeAt(0) >= 32)
    .join("")
    .trim()
    .slice(0, 80);
  return n.length >= 1 ? n : null;
}

export async function planAcknowledgement(user: AckUser, body: AckBody, ops: AckOps, ctx: AckContext): Promise<AckPlan> {
  const steps = vowStepsLeft(user, ctx.now);
  const firstName = cleanName(body.firstName);

  // ── the registrant answer, only while owed ──────────────────────────────────────────
  let registrant: { isRegistrant: boolean; flag: boolean } | null = null;
  if (steps.needsRegistrantAnswer) {
    const decl = readDeclaration(body);
    if (!decl) return { ok: false, status: 400, error: "Tell us whether you are a licensed real estate registrant." };
    if (decl === "registrant") {
      // A registrant gets no records, so owes no password and no agreement. The answer is
      // stored, the name if offered, and the row goes to the review list.
      return { ok: true, firstName, homeStreetSlug: null, registrant: { isRegistrant: true, flag: true }, reviewer: false, agreement: false, consents: [], password: { kind: "none" } };
    }
    if (decl === "reviewer") {
      // R-8.21: held for review, nothing else asked. The route sets the reviewer-hold flag and
      // emails the owner; when the owner clears it, the account completes the consumer card.
      return { ok: true, firstName, homeStreetSlug: null, registrant: { isRegistrant: false, flag: false }, reviewer: true, agreement: false, consents: [], password: { kind: "none" } };
    }
    registrant = { isRegistrant: false, flag: false };
  }
  if (steps.registrant || user.reviewFlag === REVIEW_FLAG.registrant) {
    return { ok: false, status: 403, error: "This VOW is for consumers. Email Aamir if your answer was a mistake." };
  }
  if (steps.reviewerHeld) {
    // A held reviewer cannot un-hold themselves by posting; only the owner clears it.
    return { ok: false, status: 403, error: "This account is held for a VOW review until the broker of record clears it." };
  }

  // ── the home street, optional, registry-checked ─────────────────────────────────────
  const streetRaw = typeof body.homeStreetSlug === "string" ? body.homeStreetSlug.trim().toLowerCase() : "";
  let homeStreetSlug: string | null = null;
  if (streetRaw) {
    if (!(await ops.streetExists(streetRaw))) return { ok: false, status: 400, error: "Pick a street from the list." };
    homeStreetSlug = streetRaw;
  }

  // ── the agreement, when owed ────────────────────────────────────────────────────────
  const agreement = steps.needsAcknowledgement;
  const consents: ConsentRow[] = [];
  if (agreement) {
    if (!user.vowAcknowledgedAt && !firstName && !user.firstName) return { ok: false, status: 400, error: "Tell us your name." };
    if (body.consent !== true) return { ok: false, status: 400, error: "Tick the box to continue." };
    if (user.vowAcknowledgedAt && user.vowAcknowledgementText) {
      // The earlier agreement, carried into history before it is replaced on the row.
      consents.push({
        version: user.vowAcknowledgementVersion ?? 0,
        text: user.vowAcknowledgementText,
        at: user.vowAcknowledgedAt,
        ip: user.vowAcknowledgementIp,
        userAgent: user.vowAcknowledgementUserAgent,
      });
    }
    consents.push({ version: VOW_TERMS_VERSION, text: VOW_ACKNOWLEDGEMENT_TEXT, at: ctx.now, ip: ctx.ip, userAgent: ctx.userAgent });
  }

  // ── the password: set, or renew ─────────────────────────────────────────────────────
  let password: PasswordAction = { kind: "none" };
  if (steps.needsPassword) {
    const verdict = judgePassword(body.password, user.email);
    if (!verdict.ok) return { ok: false, status: 400, error: verdict.error };
    password = { kind: "set", password: body.password as string };
  } else if (steps.needsPasswordRenewal) {
    if (typeof body.password !== "string" || !body.password) {
      return { ok: false, status: 400, error: "Confirm your password, or choose a new one." };
    }
    if (await ops.passwordMatches(body.password)) {
      password = { kind: "reconfirm" };
    } else {
      const verdict = judgePassword(body.password, user.email);
      if (!verdict.ok) return { ok: false, status: 400, error: verdict.error };
      password = { kind: "replace", password: body.password };
    }
  }

  return { ok: true, firstName, homeStreetSlug, registrant, reviewer: false, agreement, consents, password };
}
