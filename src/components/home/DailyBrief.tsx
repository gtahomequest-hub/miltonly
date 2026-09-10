// src/components/home/DailyBrief.tsx
// The daily brief signup. Source "daily-brief", watch kind "brief".
//
// THIS WAS THE SECOND WRITER OF THE SAME SOURCE. It posted to the old monolith route with source
// "daily-brief" while src/components/lead/DailyBriefSignup.tsx posted the same source
// through the guarded path, so which guards ran and whether a watch was left behind
// depended on which page the visitor happened to be on. A signup here got no honeypot
// check, no environment tag, no source-specific confirmation and no SavedSearch of kind
// "brief", which means the brief sender would never have found these people. One writer
// now: the shared client helper.
//
// CASL: the disclosure is shown under the field and travels with the submission as
// `consentText` + `consentTimestamp`. The one ingest path persists both.
'use client';

import { useState } from 'react';
import { postLeadDetailed, honeypotInputProps, HONEYPOT_WRAPPER_STYLE } from '@/lib/postLeadClient';
import { SectionHead } from './SectionHead';

const CONSENT_TEXT =
  'I consent to receive the Miltonly daily brief and follow-up communication from ' +
  'Aamir Yaqoob (RE/MAX Realty Specialists Inc., Brokerage). I can withdraw consent ' +
  'anytime by clicking unsubscribe.';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    const result = await postLeadDetailed({
      source: 'daily-brief',
      intent: 'buy',
      email: trimmed,
      notes: 'Daily brief signup, homepage',
      consent: true,
      consentText: CONSENT_TEXT,
      consentTimestamp: new Date().toISOString(),
      honeypot: honey,
    });
    if (!result.ok) {
      setError(result.error || 'Something went wrong. Please try again.');
      setState('idle');
      return;
    }
    setState('done');
  }

  return (
    <section className="mh-sec mh-brief" id="brief">
      <div className="m-wrap">
        <SectionHead
          index="05"
          title="The Milton daily brief"
          standfirst="What came to market, what sold, and what it means — one short email, written from the same data this page is built on."
        />
        {state === 'done' ? (
          <p className="mh-briefdone">
            You are on the list. The next brief arrives tomorrow morning.
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
            {/* Honeypot. A person never sees it; a bot fills it and the row is silently dropped. */}
            <div style={HONEYPOT_WRAPPER_STYLE} aria-hidden="true">
              <label>
                Company website
                <input {...honeypotInputProps} type="text" value={honey} onChange={(e) => setHoney(e.target.value)} />
              </label>
            </div>
            <p className="mh-briefconsent">{CONSENT_TEXT}</p>
            {error ? <p className="mh-brieferror">{error}</p> : null}
          </form>
        )}
      </div>
    </section>
  );
}

export default DailyBrief;
