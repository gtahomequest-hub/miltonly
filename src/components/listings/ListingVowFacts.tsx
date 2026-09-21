"use client";
// src/components/listings/ListingVowFacts.tsx
// THE VOW ISLAND ON A LISTING PAGE (MC-029). The page is ISR and carries none of the withheld
// per-listing facts (src/lib/listings/vow.ts). This island asks /api/listings/[mls]/vow, whose
// session check is the gate, and renders one of three states: the sign-in line the server
// renders for everyone (the default from the first byte), the one-time acknowledgement card for
// a signed-in person who has not yet acknowledged (MP-002), or the facts themselves.
//
// The anonymous line names the category, never a value: "time on market" and "price history"
// are what the person gets, not a day count or a prior price.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import VowAcknowledgementPrompt from "@/components/vow/VowAcknowledgementPrompt";
import { formatDateProse, formatDays, formatMoneyWhole } from "@/lib/figureFormat";
import type { ListingVowFacts as Facts, ListingVowResponse } from "@/app/api/listings/[mlsNumber]/vow/route";

// The VOW consumer notice, the exact sentence MC-036 item 5 specifies from PropTx's VOW Best
// Practices. It is printed in every state of the island, so the sentence is on the page from
// the first byte: under the sign-in line for an anonymous reader and under the facts for an
// acknowledged one. No Oxford comma: a battery check matches the string exactly.
export const VOW_BONA_FIDE_NOTICE =
  "The information provided herein must only be used by consumers that have a bona fide interest in the purchase, sale or lease of real estate and may not be used for any commercial purpose or any other purpose.";

const STATUS_WORD: Record<string, string> = {
  active: "Active, for sale",
  sold: "Sold",
  expired: "Expired",
  rented: "For lease",
};

function statusLine(f: Facts): string {
  if (f.status === "rented") {
    if (f.leaseStatus === "active") return "Active, for lease";
    if (f.leaseStatus === "leased") return "Leased";
    return f.leaseStatus ? `Lease ${f.leaseStatus}` : "For lease";
  }
  return STATUS_WORD[f.status] ?? f.status;
}

export default function ListingVowFacts({ mlsNumber, isRental }: { mlsNumber: string; isRental: boolean }) {
  const [state, setState] = useState<"loading" | "done">("loading");
  const [resp, setResp] = useState<ListingVowResponse | null>(null);
  const [generation, setGeneration] = useState(0);
  const refetch = useCallback(() => setGeneration((g) => g + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/listings/${encodeURIComponent(mlsNumber)}/vow`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: ListingVowResponse) => {
        if (cancelled) return;
        setResp(d);
        setState("done");
      })
      .catch(() => {
        if (!cancelled) setState("done");
      });
    return () => {
      cancelled = true;
    };
  }, [mlsNumber, generation]);

  const signinHref = `/signin?redirect=${encodeURIComponent(`/listings/${mlsNumber}#vow-facts`)}&intent=sold`;

  if (state === "done" && resp && !resp.canSee && resp.needsAcknowledgement) {
    return (
      <section id="vow-facts" className="mt-6">
        <VowAcknowledgementPrompt onDone={refetch} />
      </section>
    );
  }

  if (state === "done" && resp && resp.canSee && resp.facts) {
    const f = resp.facts;
    const rows: Array<[string, string]> = [
      ["Status", statusLine(f)],
      ["Time on market", formatDays(f.daysOnMarket)],
      ["Listed", formatDateProse(f.listedAt)],
    ];
    if (f.priorPrice != null && f.priorPrice > 0) {
      const when = f.priceChangedAt ? ` on ${formatDateProse(f.priceChangedAt)}` : "";
      rows.push(["Price history", `Asking was ${formatMoneyWhole(f.priorPrice)}${isRental ? "/mo" : ""} before the change${when}`]);
    } else {
      rows.push(["Price history", "No change observed on this site"]);
    }
    if (f.soldPrice != null) rows.push(["Sold for", `${formatMoneyWhole(f.soldPrice)}${f.soldDate ? ` on ${formatDateProse(f.soldDate)}` : ""}`]);
    return (
      <section id="vow-facts" data-vow-facts className="mt-6 rounded-xl border border-[#dfe0dc] bg-white p-5">
        <p className="text-[12px] font-bold text-[#6b6f6a] uppercase tracking-[0.14em] mb-3">Listing history</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[14px] text-[#073126]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-[#6b6f6a]">{k}</dt>
              <dd className="font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[12px] text-[#6b6f6a]">Shown to you under your VOW acknowledgement. Not for redistribution.</p>
        <p className="mt-2 text-[11px] text-[#6b6f6a]" data-vow-notice>{VOW_BONA_FIDE_NOTICE}</p>
      </section>
    );
  }

  // The default the server renders: anonymous, or the fetch has not answered yet.
  return (
    <section id="vow-facts" data-vow-gate className="mt-6 rounded-xl border border-[#dfe0dc] bg-[#f6f4ef] p-5">
      <p className="text-[14px] text-[#073126]">
        <Link href={signinHref} className="font-bold text-[#017848] hover:underline">
          Sign in free
        </Link>{" "}
        for this listing&rsquo;s time on market and price history. Your email is your username; you choose a password.
      </p>
      <p className="mt-2 text-[11px] text-[#6b6f6a]" data-vow-notice>{VOW_BONA_FIDE_NOTICE}</p>
    </section>
  );
}
