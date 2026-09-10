// src/components/home/DailyBrief.tsx
// The daily brief signup.
//
// POSTS TO /api/leads, source "daily-brief". Leads owns the model (ruling, 2026-09-10):
// there is no subscription table, no second identity for the same person, and nothing in
// this file writes to a database. The generic lead path accepts an email-only submission,
// which is the whole point — a brief signup that demands a phone number is not a brief
// signup.
//
// CASL: the disclosure text is shown above the field and travels with the submission as
// `consentText` + `consentTimestamp`, the same keys the valuation card sends. The generic
// lead path does not persist them today; the lead-magnet branch that does also requires a
// phone number. Passing them regardless means the moment Leads wires consent capture into
// the generic path, this surface is already sending it — and until then the disclosure the
// visitor agreed to is at least stated on screen rather than assumed. Flagged for Leads.
'use client';

import { useState } from 'react';
import { attributionPayload } from '@/lib/attribution';
import { SectionHead } from './SectionHead';

const CONSENT_TEXT =
  'I consent to receive the Miltonly daily brief and follow-up communication from ' +
  'Aamir Yaqoob (RE/MAX Realty Specialists Inc., Brokerage). I can withdraw consent ' +
  'anytime by clicking unsubscribe.';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HONEYPOT_FIELD = 'company_website';

export function DailyBrief() {
  const [email, setEmail] = useState('');
  const [honey, setHoney] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }
    setState('sending');
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmed,
          source: 'daily-brief',
          intent: 'daily-brief',
          consent: true,
          consentText: CONSENT_TEXT,
          consentTimestamp: new Date().toISOString(),
          [HONEYPOT_FIELD]: honey,
          ...attributionPayload(),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; success?: boolean; error?: string };
      if (!res.ok || data.error) {
        setError(data.error || 'Something went wrong. Please try again.');
        setState('idle');
        return;
      }
      setState('done');
    } catch {
      setError('Something went wrong. Please try again.');
      setState('idle');
    }
  }

  return (
    <section className="mh-sec mh-brief" id="brief">
      <div className="m-wrap">
        <SectionHead
          index="05"
          title="The Milton daily brief"
          standfirst="What came to market, what sold, and what it means. One short email, written from the same data this page is built on."
        />
        {state === 'done' ? (
          <p className="mh-briefdone">
            You are on the list. Your first brief lands the next weekday morning.
          </p>
        ) : (
          <form className="mh-briefform" onSubmit={submit}>
            <label className="mh-brieflabel" htmlFor="mh-brief-email">
              Email address
            </label>
            <div className="mh-briefrow">
              <input
                id="mh-brief-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
              <button type="submit" disabled={state === 'sending'}>
                {state === 'sending' ? 'Adding you…' : 'Send me the brief'}
              </button>
            </div>
            {/* honeypot — never shown, never focusable */}
            <input
              type="text"
              name={HONEYPOT_FIELD}
              value={honey}
              onChange={(e) => setHoney(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="mh-honey"
            />
            <p className="mh-briefconsent">{CONSENT_TEXT}</p>
            {error ? <p className="mh-brieferror">{error}</p> : null}
          </form>
        )}
      </div>
    </section>
  );
}

export default DailyBrief;
