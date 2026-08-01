"use client";
// Seller conversion for /sold — the highest-intent surface on the site (someone
// reading sold prices is often weighing a sale). Wires the EXISTING lead pipeline
// (/api/leads/create, the same ingress the condo + ads forms use) — no new path.
// Captures the visitor's OWN info only; exposes no sold record or price.
import { useState } from "react";

type Status = "idle" | "submitting" | "ok" | "error";

export default function SoldValuationCTA() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus("submitting");
    try {
      const res = await fetch("/api/leads/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "sold-home-valuation",
          intent: "sell",
          email,
          property_address: address || undefined,
          notes: `Home-value request from /sold${address ? ` — ${address}` : ""}`,
          event_source_url: typeof window !== "undefined" ? window.location.href : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      setStatus(res.ok && data?.ok !== false ? "ok" : "error");
    } catch {
      setStatus("error");
    }
  };

  return (
    <section className="sv-sell" id="sv-sell">
      <div className="sv-wrap">
        <div className="sv-sell-card">
          <div className="sv-sell-k">Thinking of selling?</div>
          <h2 className="sv-sell-h">
            See what <em>your</em> home would sell for
          </h2>
          <p className="sv-sell-p">
            You&rsquo;ve seen what the market&rsquo;s doing. Get a grounded, no-obligation read on your
            own home&rsquo;s value — based on the same real Milton closings, not a portal guess.
          </p>

          {status === "ok" ? (
            <p className="sv-sell-done">
              Got it — Miltonly will be in touch with your home&rsquo;s value{address ? ` for ${address}` : ""}. Talk soon.
            </p>
          ) : !open ? (
            <button type="button" className="sv-cta" onClick={() => setOpen(true)}>
              Get my home&rsquo;s value →
            </button>
          ) : (
            <form className="sv-sell-form" onSubmit={submit}>
              <input
                type="text"
                placeholder="Your street or address (optional)"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                aria-label="Your street or address"
              />
              <div className="sv-sell-row">
                <input
                  type="email"
                  required
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-label="Email"
                />
                <button type="submit" disabled={status === "submitting"}>
                  {status === "submitting" ? "Sending…" : "Send"}
                </button>
              </div>
              {status === "error" && (
                <div className="sv-sell-err">Something went wrong — please try again.</div>
              )}
              <div className="sv-sell-fine">No spam, no obligation. Miltonly · RE/MAX Realty Specialists Inc.</div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
