"use client";

// The card (MP-002 shape; MP-002b the password; MP-006 the nine clauses, the registrant
// question, the renewal, the re-consent). Rendered inline by whichever surface a signed-in
// person asks for VOW records on: the street island, /sold, VowGate. Not a modal; it blocks
// the records, not the page.
//
// It asks /api/auth/me which parts the row still owes (vowStepsLeft, src/lib/vow-access.ts)
// and renders only those:
//   the agreement    the numbered terms (VOW_TERMS_CLAUSES, the privacy clause in bold), one
//                    tick; with the first agreement, the name and the optional home street.
//                    A person who agreed to an older text sees "the terms have changed" and
//                    the terms and the tick only.
//   the registrant   "Are you a licensed real estate registrant?" yes / no, whenever unanswered.
//                    A yes ends the card with a note: the VOW is for consumers, contact Aamir.
//   the password     "Choose a password" and "Type it again", whenever the row has none.
//   the renewal      when the password is 90 days old: "Confirm your password, or choose a new
//                    one", the same two fields.
// The street field is the registry autocomplete (/api/autocomplete?type=street), so what is
// stored is a ResidentialStreet slug the server has checked, never free text.
//
// `onDone` lets a client island refetch; without it the card refreshes the server tree, which
// is what /sold and VowGate need. Styles are its own sheet (vow-card.css).

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { VOW_TERMS_CLAUSES, VOW_TERMS_VERSION } from "@/lib/vow-acknowledgement";
import { PORTAL_CONSENT_TEXT } from "@/lib/portal/consent";
import { MIN_PASSWORD_LENGTH, PASSWORD_MAX_DAYS } from "@/lib/portal/passwordRule";
import "./vow-card.css";

interface StreetHit {
  name: string;
  slug: string;
}

interface Me {
  email: string;
  firstName: string | null;
  needsAcknowledgement?: boolean;
  needsReconsent?: boolean;
  needsPassword?: boolean;
  needsPasswordRenewal?: boolean;
  needsRegistrantAnswer?: boolean;
  registrant?: boolean;
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
  const [registrant, setRegistrant] = useState<"yes" | "no" | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const searchSeq = useRef(0);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d: { user?: Me | null }) => {
        if (d.user) setMe(d.user);
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

  // Until /me answers, everything a first-timer owes shows; the answer only ever hides parts.
  const needsAck = me ? me.needsAcknowledgement !== false : true;
  const reconsent = me ? me.needsReconsent === true : false;
  const firstAgreement = needsAck && !reconsent;
  const needsPassword = me ? me.needsPassword !== false : true;
  const needsRenewal = me ? me.needsPasswordRenewal === true : false;
  const needsRegistrant = me ? me.needsRegistrantAnswer !== false : true;
  const isRegistrant = me ? me.registrant === true : false;
  const askName = firstAgreement && !(me && me.firstName);
  const askPassword = needsPassword || needsRenewal;

  async function submit() {
    if (submitting) return;
    if (needsAck && !agreed) return;
    if (needsRegistrant && registrant === null) {
      setError("Tell us whether you are a licensed real estate registrant.");
      return;
    }
    if (askName && !firstName.trim()) {
      setError("Tell us your name.");
      return;
    }
    if (firstAgreement && streetQuery.trim() && !street) {
      setError("Pick your street from the list, or clear the field.");
      return;
    }
    if (askPassword && registrant !== "yes") {
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
          ...(needsAck ? { consent: true } : {}),
          ...(askName ? { firstName: firstName.trim() } : {}),
          ...(firstAgreement && street ? { homeStreetSlug: street.slug } : {}),
          ...(needsRegistrant && registrant ? { isRegistrant: registrant === "yes" } : {}),
          ...(askPassword && registrant !== "yes" ? { password } : {}),
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

  if (isRegistrant) {
    return (
      <section data-vow-ack data-vow-registrant>
        <p className="vc-k">Registered consumers only</p>
        <h3 className="vc-h">This VOW is for consumers</h3>
        <p className="vc-lead">
          You told us you are a licensed real estate registrant. Under TRREB&apos;s VOW rules the sold and leased records
          here are for consumers with a bona fide interest in buying, selling or leasing; registrants have their board&apos;s
          own tools. If that answer was a mistake, email Aamir and he will put it right by hand.
        </p>
      </section>
    );
  }

  const heading = reconsent
    ? "The terms have changed"
    : firstAgreement
      ? "Sold prices are for registered consumers"
      : needsRenewal
        ? "Renew your password"
        : "Choose a password to finish";
  const kicker = reconsent ? "Please agree again" : firstAgreement ? "One-time acknowledgement" : "One-time setup";

  return (
    <section data-vow-ack>
      <p className="vc-k">{kicker}</p>
      <h3 className="vc-h">{heading}</h3>
      <p className="vc-lead">
        {reconsent ? (
          <>
            The terms of use for sold and leased MLS<sup>®</sup> records are now version {VOW_TERMS_VERSION}, with the
            clauses TRREB and PropTx ask every VOW to carry. Read them and agree once more; nothing else changes.
          </>
        ) : firstAgreement ? (
          <>
            Under TRREB&apos;s VOW rules, sold and leased MLS<sup>®</sup> records go to registered consumers with a bona fide
            interest in buying, selling or leasing. Registration is a username and a password: your username is your email
            {me?.email ? <>, <strong>{me.email}</strong></> : null}. Answer one question, tell us your name, choose a password,
            read the terms and agree once.
          </>
        ) : needsRenewal ? (
          <>
            Under TRREB&apos;s VOW rules a password is valid for {PASSWORD_MAX_DAYS} days. Yours is {PASSWORD_MAX_DAYS} days
            old: type it again to keep it, or choose a new one. Then the sold prices open as before.
          </>
        ) : (
          <>
            TRREB&apos;s VOW rules ask for a username and a password. Your username is your email
            {me?.email ? <>, <strong>{me.email}</strong></> : null}. Choose a password and the sold prices open.
          </>
        )}
      </p>

      {needsRegistrant && (
        <fieldset className="vc-fieldset" data-vow-registrant-question>
          <legend className="vc-label">Are you a licensed real estate registrant (a REALTOR&reg; or brokerage staff)?</legend>
          <div className="vc-radios">
            <label className="vc-radio">
              <input type="radio" name="vow-registrant" value="no" checked={registrant === "no"} onChange={() => setRegistrant("no")} />
              <span>No, I am a consumer</span>
            </label>
            <label className="vc-radio">
              <input type="radio" name="vow-registrant" value="yes" checked={registrant === "yes"} onChange={() => setRegistrant("yes")} />
              <span>Yes, I am a registrant</span>
            </label>
          </div>
        </fieldset>
      )}

      {firstAgreement && (
        <div className="vc-fields">
          {askName && (
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
          )}
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

      {askPassword && registrant !== "yes" && (
        <div className="vc-fields" data-vow-password>
          <label className="vc-field">
            <span className="vc-label">
              {needsRenewal ? "Your password, or a new one" : "Choose a password"} <small>({MIN_PASSWORD_LENGTH} characters or more)</small>
            </span>
            <input
              type="password"
              className="vc-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={needsRenewal ? "current-password" : "new-password"}
              minLength={MIN_PASSWORD_LENGTH}
              placeholder={needsRenewal ? "Type it again to keep it" : "A short sentence works well"}
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
          <div className="vc-texts" data-vow-terms data-vow-terms-version={VOW_TERMS_VERSION}>
            <p className="vc-terms-head">Terms of use, version {VOW_TERMS_VERSION}</p>
            <ol className="vc-terms">
              {VOW_TERMS_CLAUSES.map((c) => (
                <li key={c.key} data-clause={c.key}>
                  {c.bold ? <strong>{c.text}</strong> : c.text}
                </li>
              ))}
            </ol>
            <p className="vc-consent">{PORTAL_CONSENT_TEXT}</p>
          </div>

          <label className="vc-agree">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              aria-label="I agree to the terms of use and the consent statement above"
            />
            <span>I agree to the terms of use and the consent statement above.</span>
          </label>
        </>
      )}

      {error && <p className="vc-error">{error}</p>}

      <button type="button" className="vc-submit" onClick={submit} disabled={(needsAck && !agreed) || submitting}>
        {submitting
          ? "Saving…"
          : registrant === "yes"
            ? "Save my answer"
            : needsAck
              ? "Agree and see sold prices"
              : needsRenewal
                ? "Renew and see sold prices"
                : "Save password and see sold prices"}
      </button>

      <p className="vc-fine">
        Source: TREB MLS<sup>®</sup> VOW. Your agreement is recorded with the text shown, its version, a timestamp, your IP
        address and browser, as the VOW rules require. Registration records are kept for at least 180 days after a
        password expires. Your activity on this VOW is logged and may be shared with PropTx for auditing.
      </p>
    </section>
  );
}
