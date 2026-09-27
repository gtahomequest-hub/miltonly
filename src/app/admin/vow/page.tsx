// /admin/vow — the VOW desk (MP-007). Behind the admin cookie (src/lib/adminAuth.ts, the same
// one /admin/review uses), force-dynamic, noindex. Server component only: the sign-in and the
// Clear hold are plain forms. It reads the reviewers held for a PropTx / TRREB review (R-8.21)
// and clears their holds; it reads who and when, never a listing, a place or a price.

import type { Metadata } from "next";
import { cookies } from "next/headers";

import { clearReviewerHoldAction } from "@/app/admin/vow/actions";
import { verifyAdminCookieValue } from "@/lib/adminAuth";
import { listHeldReviewers } from "@/lib/vow/hold";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "VOW desk",
  robots: { index: false, follow: false },
};

const OUTCOME: Record<string, string> = {
  cleared: "Hold cleared. The account now completes the consumer card and sees the same view.",
  "not-held": "That account was not held; nothing changed.",
  "not-found": "No such account.",
  refused: "Not done: sign in again.",
};

export default async function VowDeskPage({ searchParams }: { searchParams: Promise<{ hold?: string }> }) {
  const sp = await searchParams;
  const isAuth = verifyAdminCookieValue(cookies().get("miltonly_admin")?.value);

  if (!isAuth) {
    return (
      <main className="mx-auto max-w-sm px-5 py-12">
        <h1 className="text-[22px] font-extrabold text-[#073126]">VOW desk</h1>
        <p className="mt-2 text-[13px] text-[#6b6f6a]">Sign in on the admin review page first, then return here.</p>
        <a href="/admin/review" className="mt-4 inline-block text-[13px] text-[#017848] underline">
          Go to admin sign-in
        </a>
      </main>
    );
  }

  const held = await listHeldReviewers();

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-[22px] font-extrabold text-[#073126]">VOW desk</h1>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[#6b6f6a]">
        Accounts held for a PropTx or TRREB review (MLS&reg; Rule 8.21). Confirm the organization by email from the same
        address the account used, then clear the hold. The account then completes the same card a consumer does and sees
        exactly what a consumer sees. Administrator credentials are never shared, with a reviewer or with anyone else.
      </p>

      {sp.hold ? (
        <p className="mt-4 text-[13px] font-semibold text-[#073126]" data-hold-outcome={sp.hold}>
          {OUTCOME[sp.hold] ?? sp.hold}
        </p>
      ) : null}

      <h2 className="mt-8 text-[15px] font-bold text-[#073126]">Held for review ({held.length})</h2>
      {held.length === 0 ? (
        <p className="mt-2 text-[13px] text-[#6b6f6a]" data-held-empty>
          Nobody is held for review.
        </p>
      ) : (
        <table className="mt-3 w-full border-collapse text-[13px]" data-held-table>
          <thead>
            <tr className="border-b border-[#dfe0dc] text-left text-[#6b6f6a]">
              <th className="py-2 pr-4 font-medium">Email</th>
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Declared</th>
              <th className="py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {held.map((r) => (
              <tr key={r.id} className="border-b border-[#f0efea]" data-held-row={r.email}>
                <td className="py-2 pr-4">{r.email}</td>
                <td className="py-2 pr-4">{r.firstName ?? "(none)"}</td>
                <td className="py-2 pr-4 tabular-nums">
                  {(r.reviewFlaggedAt ?? r.createdAt).toLocaleString("en-CA", { timeZone: "America/Toronto", dateStyle: "medium", timeStyle: "short" })}
                </td>
                <td className="py-2">
                  <form action={clearReviewerHoldAction}>
                    <input type="hidden" name="userId" value={r.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-[#dfe0dc] px-2.5 py-1 text-[13px] font-medium hover:bg-[#f6f4ef]"
                      data-action="clear-hold"
                    >
                      Clear hold
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
