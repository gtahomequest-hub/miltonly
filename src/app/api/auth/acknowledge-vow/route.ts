// POST /api/auth/acknowledge-vow: the card (MP-002 shape, MP-002b the password, MP-006 the
// nine clauses, the registrant question, the renewal and the re-consent).
//
// The decision is planAcknowledgement() in src/lib/portal/acknowledge.ts, which the prebuild
// runs against stubs; this file is the two things it must not own, the registry lookup and the
// bcrypt compare, and the one write that follows. Everything is judged before anything is
// written, so a bad password leaves the agreement unrecorded too and the card comes back whole.
//
// What the write records: the four VOW fields (timestamp, literal text, IP, user agent) plus
// the version, on the User row (the latest) AND as VowConsent rows (the history: the earlier
// agreement first, when the row had one and the history lacks it, then the new one); the PIPEDA
// consent pair; the name and the optional home street; the registrant answer with its review
// flag; the password, set or renewed (a reconfirmation keeps the hash and restarts the clock).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, touchSession } from "@/lib/auth";
import { VOW_ACKNOWLEDGEMENT_TEXT, VOW_TERMS_VERSION } from "@/lib/vow-acknowledgement";
import { PORTAL_CONSENT_TEXT } from "@/lib/portal/consent";
import { hashPassword, verifyPassword } from "@/lib/portal/password";
import { planAcknowledgement } from "@/lib/portal/acknowledge";
import { vowStepsLeft, REVIEW_FLAG } from "@/lib/vow-access";
import { sendReviewerHeldOwnerEmail } from "@/lib/email-user";

export const dynamic = "force-dynamic";

function getIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const now = new Date();
  const plan = await planAcknowledgement(
    user,
    body,
    {
      streetExists: async (slug) => !!(await prisma.residentialStreet.findUnique({ where: { slug }, select: { slug: true } })),
      passwordMatches: (password) => verifyPassword(password, user.passwordHash),
    },
    { ip: getIp(req), userAgent: req.headers.get("user-agent") || "unknown", now },
  );
  if (!plan.ok) {
    return NextResponse.json({ error: plan.error }, { status: plan.status });
  }

  const passwordData =
    plan.password.kind === "set" || plan.password.kind === "replace"
      ? { passwordHash: await hashPassword(plan.password.password), passwordSetAt: now }
      : plan.password.kind === "reconfirm"
        ? { passwordSetAt: now }
        : {};

  // The reviewer declaration (R-8.21) holds the account: isRegistrant false, but the
  // reviewer-hold flag stands until the owner clears it from the desk.
  const registrantData = plan.reviewer
    ? { isRegistrant: false, registrantAt: now, reviewFlag: REVIEW_FLAG.reviewerHeld, reviewFlaggedAt: now }
    : plan.registrant
      ? {
          isRegistrant: plan.registrant.isRegistrant,
          registrantAt: now,
          ...(plan.registrant.flag ? { reviewFlag: user.reviewFlag ?? REVIEW_FLAG.registrant, reviewFlaggedAt: user.reviewFlaggedAt ?? now } : {}),
        }
      : {};

  const agreementData = plan.agreement
    ? {
        vowAcknowledgedAt: now,
        vowAcknowledgementText: VOW_ACKNOWLEDGEMENT_TEXT,
        vowAcknowledgementVersion: VOW_TERMS_VERSION,
        vowAcknowledgementIp: getIp(req),
        vowAcknowledgementUserAgent: req.headers.get("user-agent") || "unknown",
        consentText: PORTAL_CONSENT_TEXT,
        consentTimestamp: now,
        vowConsents: { create: plan.consents },
      }
    : {};

  // The prior agreement is carried into history only once: skip it when a row for that text
  // is already there (a person who re-consents to version 5 later must not duplicate 4).
  if (plan.agreement && plan.consents.length === 2) {
    const prior = plan.consents[0];
    const already = await prisma.vowConsent.findFirst({ where: { userId: user.id, text: prior.text, at: prior.at }, select: { id: true } });
    if (already) agreementData.vowConsents = { create: [plan.consents[1]] };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(plan.firstName && { firstName: plan.firstName }),
      ...(plan.homeStreetSlug && { homeStreetSlug: plan.homeStreetSlug }),
      ...registrantData,
      ...agreementData,
      ...passwordData,
    },
  });

  await touchSession();

  // A reviewer declaration (R-8.21) notifies the owner, so the hold can be confirmed and
  // cleared. The email never blocks the response: the hold is on the row already.
  if (plan.reviewer) {
    await sendReviewerHeldOwnerEmail({ reviewerEmail: user.email, reviewerName: plan.firstName ?? user.firstName, at: now }).catch((e) =>
      console.error("[acknowledge-vow] reviewer notice failed", e),
    );
  }

  const after = await prisma.user.findUnique({ where: { id: user.id } });
  return NextResponse.json({
    ok: true,
    agreed: plan.agreement,
    version: VOW_TERMS_VERSION,
    ...(after ? vowStepsLeft(after) : {}),
  });
}
