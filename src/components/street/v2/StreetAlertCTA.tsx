"use client";
// DEC-CONDO-6 → STREET TIER, element 2. The buyer "Set an alert" CTA was a DEAD
// BUTTON — it linked to /listings and captured nothing (no-dead-buttons violation).
// This wires it to the EXISTING lead ingress (/api/leads/create), mirroring
// CondoCTAs.postLead verbatim, changing only source/labels. It captures the VISITOR's
// own email only — no sold record, MLS number, or address is ever posted. The route is
// source-agnostic and already live (LEADS_API_ENABLED=true); source stays distinct
// ("street-alert") so lead attribution can bucket street leads.
import { useState } from "react";

type Status = "idle" | "submitting" | "ok" | "error";

async function postLead(payload: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch("/api/leads/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, event_source_url: typeof window !== "undefined" ? window.location.href : undefined }),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok && data?.ok !== false;
  } catch {
    return false;
  }
}

export default function StreetAlertCTA({
  streetName,
  shortName,
  neighbourhood,
  headline,
  body,
  dormant,
}: {
  streetName: string;
  shortName: string;
  neighbourhood: string;
  headline: string;
  body: string;
  dormant?: boolean;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [email, setEmail] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus("submitting");
    const ok = await postLead({
      source: "street-alert",
      intent: "buyer",
      email,
      property_address: streetName,
      neighbourhood,
      notes: `Street alerts requested — ${streetName}`,
    });
    setStatus(ok ? "ok" : "error");
  };

  return (
    <div className="s-fcard s-alertcard" id="street-alert">
      <h3>{headline}</h3>
      <p>{body}</p>
      {status === "ok" ? (
        <p className="s-alert-done">Done — you&rsquo;re on the list. We&rsquo;ll email you the moment a home on {shortName} is listed or sold.</p>
      ) : (
        <form className="s-alert-form" onSubmit={submit}>
          <div className="s-alert-row">
            <input
              type="email"
              required
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label={`Email for ${shortName} alerts`}
            />
            <button type="submit" disabled={status === "submitting"}>
              {status === "submitting" ? "…" : dormant ? "Notify me" : "Set an alert"}
            </button>
          </div>
          {status === "error" && <div className="s-alert-err">Something went wrong — please try again.</div>}
          <div className="s-alert-fine">Miltonly emails only. No account, unsubscribe anytime.</div>
        </form>
      )}
    </div>
  );
}
