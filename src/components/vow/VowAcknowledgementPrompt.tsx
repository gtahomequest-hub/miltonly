"use client";

// The one-time card (MP-002 shape, MP-002b adds the password). Rendered inline by whichever
// surface a signed-in person first asks for VOW records on: the street island, /sold. Not a
// modal; it blocks the records, not the page.
//
// It asks four things and shows one: the person's name (the VOW policy wants a name with the
// email), the street they live on (the account opens on it; optional, because a buyer may not
// live in Milton yet), a password (R-805(c): twelve characters or more, the email is the
// username), and one tick that covers the VOW acknowledgement text shown in full and the
// consent sentence under it. The server records the text, the time, the IP and the browser.
//
// It asks /api/auth/me which parts are still owed, so a person who acknowledged before the
// password existed sees only the password fields, and a person who set a password but closed
// the card before agreeing sees only the acknowledgement.
//
// The street field is the registry autocomplete (/api/autocomplete?type=street), so what is
// stored is a ResidentialStreet slug the server has checked, never free text.
//
// `onDone` lets a client island refetch; without it the card refreshes the server tree, which
// is what /sold needs. Styles are its own sheet (vow-card.css): see the note there.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { VOW_ACKNOWLEDGEMENT_TEXT } from "@/lib/vow-acknowledgement";
import { PORTAL_CONSENT_TEXT } from "@/lib/portal/consent";
import { MIN_PASSWORD_LENGTH } from "@/lib/portal/passwordRule";
import "./vow-card.css";

interface StreetHit {
  name: string;
  slug: string;
}

export default function VowAcknowledgementPrompt({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [streetQuery, setStreetQuery] = useState("");
  const [street, setStreet] = useState<StreetHit | null>(null);
  const [hits, setHits] = useState<StreetHit[]>([]);
  const [open, setOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [email, setEmail] = useState("");
  // Until /me answers, both parts show; the answer only ever hides one.
  const [needsAck, setNeedsAck] = useState(true);
  const [needsPassword, setNeedsPassword] = useState(true);
  const searchSeq = useRef(0);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d: { user?: { email: string; needsAcknowledgement?: boolean; needsPassword?: boolean } | null }) => {
        if (!d.user) return;
        setEmail(d.user.email);
        setNeedsAck(d.user.needsAcknowledgement !== false);
        setNeedsPassword(d.user.needsPassword !== false);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const q = streetQuery.trim();
    if (street && q === street.name) return;
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const seq = ++searchSeq.current;
    const t = setTimeout(() => {
      fetch(`/api/autocomplete?type=street&q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((rows: StreetHit[]) => {
          if (seq !== searchSeq.current) return;
          setHits(Array.isArray(rows) ? rows : []);
          setOpen(true);
        })
        .catch(() => {});
    }, 150);
    return () => clearTimeout(t);
  }, [streetQuery, street]);

  async function submit() {
    if (submitting) return;
    if (needsAck && !agreed) return;
    if (needsAck && !firstName.trim()) {
      setError("Tell us your name.");
      return;
    }
    if (needsAck && streetQuery.trim() && !street) {
      setError("Pick your street from the list, or clear the field.");
      return;
    }
    if (needsPassword) {
      if (password.length < MIN_PASSWORD_LENGTH) {
        setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
        return;
      }
      if (password !== password2) {
        setError("The two passwords do not match.");
        return;
      }
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/acknowledge-vow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(needsAck ? { firstName: firstName.trim(), homeStreetSlug: street?.slug ?? "", consent: true } : {}),
          ...(needsPassword ? { password } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      if (onDone) onDone();
      else router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit right now.");
      setSubmitting(false);
    }
  }

  const usernameLine = email ? (
    <>
      , <strong>{email}</strong>
    </>
  ) : null;

  return (
    <section data-vow-ack>
      <p className="vc-k">{needsAck ? "One-time acknowledgement" : "One-time setup"}</p>
      <h3 className="vc-h">{needsAck ? "Sold prices are for registered consumers" : "Choose a password to finish"}</h3>
      <p className="vc-lead">
        {needsAck ? (
          <>
            Under TRREB&apos;s VOW rules, sold and leased MLS<sup>®</sup> records go to registered consumers with a bona fide
            interest in buying, selling or leasing. Registration is a username and a password: your username is your email
            {usernameLine}. Tell us your name, your street if you have one in Milton, choose a password, and agree once. You
            will not see this card again.
          </>
        ) : (
          <>
            TRREB&apos;s VOW rules ask for a username and a password. Your username is your email{usernameLine}. Choose a
            password and the sold prices open.
          </>
        )}
      </p>

      {needsAck && (
        <div className="vc-fields">
          <label className="vc-field">
            <span className="vc-label">Your name</span>
            <input
              type="text"
              className="vc-input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              placeholder="First name"
              maxLength={80}
            />
          </label>
          <label className="vc-field">
            <span className="vc-label">
              Your street in Milton <small>(optional)</small>
            </span>
            <input
              type="text"
              className="vc-input"
              value={streetQuery}
              onChange={(e) => {
                setStreetQuery(e.target.value);
                setStreet(null);
              }}
              onFocus={() => hits.length && setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 120)}
              autoComplete="off"
              placeholder="Start typing"
              role="combobox"
              aria-controls="vow-street-options"
              aria-expanded={open && hits.length > 0}
              aria-autocomplete="list"
            />
            {open && hits.length > 0 && !street && (
              <ul id="vow-street-options" className="vc-options" role="listbox">
                {hits.map((h) => (
                  <li key={h.slug} role="option" aria-selected={false}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setStreet(h);
                        setStreetQuery(h.name);
                        setOpen(false);
                      }}
                    >
                      {h.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </label>
        </div>
      )}

      {needsPassword && (
        <div className="vc-fields" data-vow-password>
          <label className="vc-field">
            <span className="vc-label">
              Choose a password <small>({MIN_PASSWORD_LENGTH} characters or more)</small>
            </span>
            <input
              type="password"
              className="vc-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              placeholder="A short sentence works well"
            />
          </label>
          <label className="vc-field">
            <span className="vc-label">Type it again</span>
            <input
              type="password"
              className="vc-input"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              placeholder="Same password"
            />
          </label>
        </div>
      )}

      {needsAck && (
        <>
          <div className="vc-texts">
            <p>{VOW_ACKNOWLEDGEMENT_TEXT}</p>
            <p>{PORTAL_CONSENT_TEXT}</p>
          </div>

          <label className="vc-agree">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              aria-label="I agree to the acknowledgement and consent above"
            />
            <span>I agree to both statements above.</span>
          </label>
        </>
      )}

      {error && <p className="vc-error">{error}</p>}

      <button type="button" className="vc-submit" onClick={submit} disabled={(needsAck && !agreed) || submitting}>
        {submitting ? "Saving…" : needsAck ? "Agree and see sold prices" : "Save password and see sold prices"}
      </button>

      <p className="vc-fine">
        Source: TREB MLS<sup>®</sup> VOW. Your agreement is recorded with the text shown, a timestamp, your IP address and
        browser, as the VOW rules require. Registration records are kept for at least 180 days after a sign-in expires.
      </p>
    </section>
  );
}
