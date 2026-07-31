"use client";
// Build B — per-building conversion (platform-branded to Miltonly, not to an agent personally).
// Two CTAs, both on every building page (thin buildings too): "Get alerts for this building"
// (low-friction email capture) and "Contact Miltonly about this building" (direct). Both POST to
// the EXISTING lead ingress (/api/leads/create). They capture the VISITOR's own info only — no
// building/unit data is exposed. Renders an inline card + a sticky bottom bar.
import { useState } from "react";

type Panel = "none" | "alert" | "contact";
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

export default function CondoCTAs({ buildingName, neighbourhood, thin }: { buildingName: string; neighbourhood: string; thin: boolean }) {
  const [panel, setPanel] = useState<Panel>("none");
  const [status, setStatus] = useState<Status>("idle");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  const open = (p: Panel) => {
    setPanel(p); setStatus("idle");
    if (typeof document !== "undefined") document.getElementById("cb-cta")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const submitAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus("submitting");
    const ok = await postLead({ source: "condo-building-alert", intent: "buyer", email, property_address: buildingName, neighbourhood, notes: `Building alerts requested — ${buildingName}` });
    setStatus(ok ? "ok" : "error");
  };
  const submitContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email && !phone) return;
    setStatus("submitting");
    const ok = await postLead({ source: "condo-building-contact", intent: "buyer", name, email, phone, property_address: buildingName, neighbourhood, notes: `${message ? message + " " : ""}[re: ${buildingName}]` });
    setStatus(ok ? "ok" : "error");
  };

  const alertHead = thin ? "Be first to know when this building trades" : "Track this building";
  const alertSub = thin
    ? "It rarely comes to market — get an email the moment a unit is listed or sold."
    : "Get an email when a unit here is listed, sold, or leased. No account, unsubscribe anytime.";

  return (
    <>
      <section className="cb-block cb-cta-wrap" id="cb-cta">
        <div className="c-wrap">
          <div className="cb-cta">
            <div className="cb-cta-eyebrow">Miltonly · {buildingName}</div>
            <h2 className="cb-cta-h">Two ways to stay ahead of this building.</h2>

            {status === "ok" ? (
              <p className="cb-cta-done">Done — you’re on the list. Miltonly will be in touch about {buildingName}.</p>
            ) : (
              <>
                <div className="cb-cta-btns">
                  <button type="button" className={`cb-cta-btn cb-cta-primary${panel === "alert" ? " is-open" : ""}`} onClick={() => open("alert")}>Get alerts for this building</button>
                  <button type="button" className={`cb-cta-btn cb-cta-ghost${panel === "contact" ? " is-open" : ""}`} onClick={() => open("contact")}>Contact Miltonly about this building</button>
                </div>

                {panel === "alert" && (
                  <form className="cb-cta-form" onSubmit={submitAlert}>
                    <div className="cb-cta-formhead"><strong>{alertHead}.</strong> {alertSub}</div>
                    <div className="cb-cta-row">
                      <input type="email" required placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email for building alerts" />
                      <button type="submit" disabled={status === "submitting"}>{status === "submitting" ? "…" : "Notify me"}</button>
                    </div>
                    {status === "error" && <div className="cb-cta-err">Something went wrong — try again, or use the contact option.</div>}
                    <div className="cb-cta-fine">Miltonly emails only. We never share your address.</div>
                  </form>
                )}

                {panel === "contact" && (
                  <form className="cb-cta-form" onSubmit={submitContact}>
                    <div className="cb-cta-formhead"><strong>Ask Miltonly about {buildingName}.</strong> Pricing, availability, or a specific unit type — we’ll get back to you.</div>
                    <div className="cb-cta-grid">
                      <input type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Your name" />
                      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
                      <input type="tel" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} aria-label="Phone" />
                    </div>
                    <textarea placeholder={`What would you like to know about ${buildingName}?`} value={message} onChange={(e) => setMessage(e.target.value)} rows={2} aria-label="Message" />
                    <div className="cb-cta-row">
                      <button type="submit" disabled={status === "submitting" || (!email && !phone)}>{status === "submitting" ? "Sending…" : "Send to Miltonly"}</button>
                    </div>
                    {status === "error" && <div className="cb-cta-err">Something went wrong — please try again.</div>}
                    <div className="cb-cta-fine">Add an email or phone so Miltonly can reply.</div>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* sticky bottom bar */}
      <div className="cb-sticky" role="complementary" aria-label="Building actions">
        <span className="cb-sticky-name">{buildingName}</span>
        <div className="cb-sticky-btns">
          <button type="button" className="cb-sticky-b cb-sticky-primary" onClick={() => open("alert")}>Get alerts</button>
          <button type="button" className="cb-sticky-b cb-sticky-ghost" onClick={() => open("contact")}>Contact Miltonly</button>
        </div>
      </div>
    </>
  );
}
