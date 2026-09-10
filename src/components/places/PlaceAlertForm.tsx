"use client";

// src/components/places/PlaceAlertForm.tsx
// Shared forest lead-capture for /mosques + /schools (replaces MosqueAlertForm +
// SchoolAlertForm).
//
// Phase 1 moved it onto the one submission path. Three defects went with the move: it
// posted to the old monolith route, it set the success state WITHOUT checking the
// response, so a 400 or a 500 rendered "You're in", and it sent intent "buyer", which the
// value model scores at 0. The area now travels as a neighbourhood so an alert signup can
// leave behind a watch a sender can read.

import { useState } from "react";
import { postLead, honeypotInputProps, HONEYPOT_WRAPPER_STYLE } from "@/lib/postLeadClient";

export default function PlaceAlertForm({
  source,
  areaPlaceholder,
  intent = "buy",
}: {
  source: string; // "mosque-alert" | "school-alert"
  areaPlaceholder: string; // "Mosque or area (optional)" | "School or area (optional)"
  intent?: "buy" | "sell" | "rent";
}) {
  const [email, setEmail] = useState("");
  const [area, setArea] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [honey, setHoney] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setFailed(false);
    const trimmedArea = area.trim();
    const ok = await postLead({
      source,
      intent,
      email,
      // The area is the watch criterion, so it travels as a neighbourhood as well as a note.
      // Blank stays blank: a watch with no criterion matches every listing in Milton, which
      // is not what someone who left the field empty asked for.
      neighbourhood: trimmedArea || undefined,
      property_address: trimmedArea || undefined,
      notes: `Alerts requested from ${source}${trimmedArea ? `, ${trimmedArea}` : ", no area given"}`,
      honeypot: honey,
    });
    setLoading(false);
    if (ok) setSubmitted(true);
    else setFailed(true);
  };

  if (submitted) {
    return (
      <p className="pl-alert-done">
        You&apos;re in — we&apos;ll email you when new listings appear near your preferred area.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="pl-alert">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your email"
      />
      <input type="text" value={area} onChange={(e) => setArea(e.target.value)} placeholder={areaPlaceholder} />
      {/* Honeypot. A person never sees it; a bot fills it and the row is silently dropped. */}
      <div style={HONEYPOT_WRAPPER_STYLE} aria-hidden="true">
        <label>
          Company website
          <input {...honeypotInputProps} type="text" value={honey} onChange={(e) => setHoney(e.target.value)} />
        </label>
      </div>
      {failed && <p className="pl-alert-err">Something went wrong. Please try again.</p>}
      <button type="submit" disabled={loading}>
        {loading ? "Sending…" : "Get alerts"}
      </button>
    </form>
  );
}
