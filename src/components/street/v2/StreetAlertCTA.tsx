"use client";
// DEC-CONDO-6 → STREET TIER, element 2. The buyer "Set an alert" CTA was a DEAD
// BUTTON — it linked to /listings and captured nothing (no-dead-buttons violation).
// This wires it to the EXISTING lead ingress (/api/leads/create), mirroring
// CondoCTAs.postLead verbatim, changing only source/labels. It captures the VISITOR's
// own email only — no sold record, MLS number, or address is ever posted. The route is
// source-agnostic and already live (LEADS_API_ENABLED=true); source stays distinct
// ("street-alert") so lead attribution can bucket street leads.
//
// Phase 1: the hand-rolled fetch is gone. postLead is the one client helper, which carries
// the honeypot and the attribution payload, and the intent is "buy" rather than "buyer" so
// the value model scores it instead of returning 0.
import { useState } from "react";
import { postLead, honeypotInputProps, HONEYPOT_WRAPPER_STYLE } from "@/lib/postLeadClient";

type Status = "idle" | "submitting" | "ok" | "error";

export default function StreetAlertCTA({
  streetName,
  shortName: streetLabel,
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
  const [honey, setHoney] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus("submitting");
    const ok = await postLead({
      source: "street-alert",
      intent: "buy",
      email,
      property_address: streetName,
      neighbourhood,
      notes: `Street alerts requested, ${streetName}`,
      honeypot: honey,
    });
    setStatus(ok ? "ok" : "error");
  };

  return (
    <div className="s-fcard s-alertcard" id="street-alert">
      <h3>{headline}</h3>
      <p>{body}</p>
      {status === "ok" ? (
        <p className="s-alert-done">Done, you&rsquo;re on the list. We&rsquo;ll email you the moment a home on {streetLabel} is listed or sold.</p>
      ) : (
        <form className="s-alert-form" onSubmit={submit}>
          <div className="s-alert-row">
            <input
              type="email"
              required
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label={`Email for ${streetLabel} alerts`}
            />
            <button type="submit" disabled={status === "submitting"}>
              {status === "submitting" ? "…" : dormant ? "Notify me" : "Set an alert"}
            </button>
          </div>
          {/* Honeypot. A person never sees it; a bot fills it and the row is silently dropped. */}
          <div style={HONEYPOT_WRAPPER_STYLE} aria-hidden="true">
            <label>
              Company website
              <input {...honeypotInputProps} type="text" value={honey} onChange={(e) => setHoney(e.target.value)} />
            </label>
          </div>
          {status === "error" && <div className="s-alert-err">Something went wrong. Please try again.</div>}
          <div className="s-alert-fine">Miltonly emails only. No account, unsubscribe anytime.</div>
        </form>
      )}
    </div>
  );
}
