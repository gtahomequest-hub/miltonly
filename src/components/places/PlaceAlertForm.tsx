"use client";

// src/components/places/PlaceAlertForm.tsx
// Shared forest lead-capture for /mosques + /schools (replaces MosqueAlertForm +
// SchoolAlertForm). FUNCTIONAL — same POST /api/leads + attributionPayload as
// before; only `source`, the second-field placeholder, and styling differ.

import { useState } from "react";
import { attributionPayload } from "@/lib/attribution";

export default function PlaceAlertForm({
  source,
  areaPlaceholder,
  intent = "buyer",
}: {
  source: string; // "mosque-alert" | "school-alert"
  areaPlaceholder: string; // "Mosque or area (optional)" | "School or area (optional)"
  intent?: string;
}) {
  const [email, setEmail] = useState("");
  const [area, setArea] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          firstName: "",
          source,
          intent,
          street: area || "Any area",
          ...attributionPayload(),
        }),
      });
      setSubmitted(true);
    } catch {
      // silent fail — lead capture is best-effort
    } finally {
      setLoading(false);
    }
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
      <button type="submit" disabled={loading}>
        {loading ? "Sending…" : "Get alerts"}
      </button>
    </form>
  );
}
