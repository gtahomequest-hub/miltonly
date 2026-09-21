'use client';

import { useState } from 'react';
import { postLead, honeypotInputProps, HONEYPOT_WRAPPER_STYLE } from '@/lib/postLeadClient';
import type { NavContext } from './megaTypes';
import { ALERT_FINE_PRINT } from '@/lib/lead/finePrint';

/** The daily-brief signup, through the one lead helper every form on the site uses. Source
 *  "daily-brief", the same as the homepage's and /sell's forms, so one list, one sender. It
 *  renders in the menu's Alerts panel and in the footer of every page (MH-006), with one set
 *  of behaviour and two sets of class names, one per surface's stylesheet.
 *
 *  IT CARRIES THE PAGE (MA-004 defect 7). On a street page the row records the street as
 *  `property_address`, on a hub the hub as `neighbourhood`, and every signup records the fine
 *  print it was made under as `consentText`. The row used to say "Daily brief signup (menu)"
 *  and nothing else, wherever it came from. Which watch the row becomes is the lead path's
 *  decision (src/lib/lead/savedSearch.ts keys the kind on the source); the fields are here
 *  for it to key on.
 *
 *  IN THE MENU ITS SUBMIT IS THE PANEL'S CTA (defect 9): the same `.m-mega-cta` every other
 *  panel ends in, making the form's own promise rather than a link to a sign-in wall. */
export function BriefSignup({
  id,
  context,
  cta = 'Send me the brief',
  where = 'menu',
  variant = 'menu',
}: {
  id: string;
  context?: NavContext;
  cta?: string;
  /** which surface the row names in its note */
  where?: string;
  variant?: 'menu' | 'footer';
}) {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'ok' | 'error'>('idle');
  const [email, setEmail] = useState('');
  const [honey, setHoney] = useState('');
  const footer = variant === 'footer';
  const cls = footer
    ? { form: 'm-fbrief', label: 'm-fbrief-label', row: 'm-fbrief-row', note: 'm-fbrief-note', ok: 'm-fbrief-note m-fbrief-ok', fine: 'm-fbrief-fine', cta: 'm-fbrief-go' }
    : { form: 'm-mega-search m-mega-brief', label: 'm-mega-label', row: 'm-mega-searchrow', note: 'm-mega-note', ok: 'm-mega-note m-mega-ok', fine: 'm-mega-fine', cta: 'm-mega-cta' };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || status === 'submitting') return;
    setStatus('submitting');
    const subject = context?.street?.name ?? context?.hub?.name;
    const ok = await postLead({
      source: 'daily-brief',
      intent: 'buy',
      email,
      property_address: context?.street?.name,
      neighbourhood: context?.hub?.name,
      notes: `Daily brief signup (${where}${subject ? `, ${subject}` : ''})`,
      consentText: ALERT_FINE_PRINT,
      consentTimestamp: new Date().toISOString(),
      honeypot: honey,
    });
    setStatus(ok ? 'ok' : 'error');
  };
  if (status === 'ok') {
    return <p className={cls.ok}>You are on the list. Your first brief lands the next weekday morning.</p>;
  }
  const button = (
    <button type="submit" className={cls.cta} disabled={status === 'submitting'}>
      {status === 'submitting' ? 'Sending…' : cta}
      {footer ? null : <span aria-hidden="true"> →</span>}
    </button>
  );
  return (
    <form className={cls.form} onSubmit={submit}>
      <label htmlFor={id} className={cls.label}>
        The Milton daily brief
      </label>
      <div className={cls.row}>
        <input id={id} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" />
        {footer ? button : null}
      </div>
      {/* Honeypot. A person never sees it; a bot fills it and the row is silently dropped. */}
      <div style={HONEYPOT_WRAPPER_STYLE} aria-hidden="true">
        <label>
          Company website
          <input {...honeypotInputProps} type="text" value={honey} onChange={(e) => setHoney(e.target.value)} />
        </label>
      </div>
      {status === 'error' ? <p className={cls.note}>Something went wrong. Please try again.</p> : null}
      <p className={cls.fine}>{ALERT_FINE_PRINT}</p>
      {footer ? null : button}
    </form>
  );
}

export default BriefSignup;
