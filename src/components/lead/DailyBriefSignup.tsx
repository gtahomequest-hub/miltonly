"use client";

// The daily brief signup. Source "daily-brief", watch kind "brief".
//
// THE SENDER IS A LATER STEP AND THIS COPY IS WRITTEN NOT TO OUTRUN IT. The button says the
// brief starts tomorrow because a "brief" watch is deliberately excluded from
// /api/alerts/match — that job sends match notifications, and a daily digest of what changed
// is a different thing with a different query. Until its sender exists, this collects the
// list and the confirmation email says only that.
//
// Every other alert surface on the site made a promise nothing kept. This one names what it
// can honour today.

import { useState } from "react";
import { postLead, honeypotInputProps, HONEYPOT_WRAPPER_STYLE } from "@/lib/postLeadClient";
import { config } from "@/lib/config";

type Status = "idle" | "submitting" | "ok" | "error";

export default function DailyBriefSignup({ className = "" }: { className?: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [email, setEmail] = useState("");
  const [honey, setHoney] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || status === "submitting") return;
    setStatus("submitting");
    const ok = await postLead({
      source: "daily-brief",
      intent: "buy",
      email,
      notes: `Daily brief signup`,
      honeypot: honey,
    });
    setStatus(ok ? "ok" : "error");
  };

  return (
    <div className={`s-fcard ${className}`}>
      <h3>The {config.CITY_NAME} daily brief</h3>
      {status === "ok" ? (
        <p>
          You are on the list. The brief starts tomorrow morning, and it is only what changed:
          what listed, what sold, and what moved on price.
        </p>
      ) : (
        <>
          <p>
            One email each morning. What listed, what sold, what moved on price. Nothing else,
            and no newsletter.
          </p>
          <form className="s-alert-form" onSubmit={submit}>
            <div className="s-alert-row">
              <input
                type="email"
                required
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label={`Email for the ${config.CITY_NAME} daily brief`}
              />
              <button type="submit" disabled={status === "submitting"}>
                {status === "submitting" ? "…" : "Send me the brief"}
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
        </>
      )}
    </div>
  );
}
