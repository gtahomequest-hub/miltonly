'use client';

import { useState } from 'react';
import { postLead, honeypotInputProps, HONEYPOT_WRAPPER_STYLE } from '@/lib/postLeadClient';
import type { NavContext } from './megaTypes';

/** The fine print under the landlord form. A request for service, not a subscription. */
export const LANDLORD_FINE_PRINT = 'Aamir replies personally, during business hours. No account, no list.';

/** The landlord's listing request, the Rent menu's Landlords panel CTA (MH-007). Through the
 *  one lead helper every form on the site uses, as source "landlord": one row, the ops alert
 *  and the confirmation the lead path already sends, and the digest counts it by that tag.
 *
 *  IT CARRIES THE PAGE, like the brief form. On a street page the row records the street as
 *  `property_address` unless the landlord typed an address, on a hub the hub as
 *  `neighbourhood`. The intent is the canonical "sell": a landlord is on the supply side, and
 *  the value model's own map sends "landlord" there (src/lib/lead/intent.ts).
 *
 *  ITS SUBMIT IS THE PANEL'S CTA: the same `.m-mega-cta` every other panel ends in, so the
 *  panel makes the form's promise rather than linking to a page that asks again. */
export function LandlordSignup({
  id,
  context,
  cta = 'List your rental with Aamir',
  where = 'menu',
}: {
  id: string;
  context?: NavContext;
  cta?: string;
  /** which surface the row names in its note */
  where?: string;
}) {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'ok' | 'error'>('idle');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [honey, setHoney] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || status === 'submitting') return;
    setStatus('submitting');
    const typed = address.trim();
    const subject = typed || context?.street?.name || context?.hub?.name;
    const ok = await postLead({
      source: 'landlord',
      intent: 'sell',
      email,
      property_address: typed || context?.street?.name,
      neighbourhood: context?.hub?.name,
      notes: `Landlord listing request (${where}${subject ? `, ${subject}` : ''})`,
      honeypot: honey,
    });
    setStatus(ok ? 'ok' : 'error');
  };
  if (status === 'ok') {
    return <p className="m-mega-note m-mega-ok">Your request is in. Aamir replies during business hours with a rent figure from the comparable leases.</p>;
  }
  return (
    <form className="m-mega-search m-mega-brief" onSubmit={submit}>
      <label htmlFor={`${id}-address`} className="m-mega-label">
        List your rental
      </label>
      <div className="m-mega-searchrow">
        <input
          id={`${id}-address`}
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={context?.street ? `Address on ${context.street.name}` : 'Address of the rental'}
          autoComplete="street-address"
        />
      </div>
      <div className="m-mega-searchrow">
        <input id={id} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" aria-label="Your email" />
      </div>
      {/* Honeypot. A person never sees it; a bot fills it and the row is silently dropped. */}
      <div style={HONEYPOT_WRAPPER_STYLE} aria-hidden="true">
        <label>
          Company website
          <input {...honeypotInputProps} type="text" value={honey} onChange={(e) => setHoney(e.target.value)} />
        </label>
      </div>
      {status === 'error' ? <p className="m-mega-note">Something went wrong. Please try again.</p> : null}
      <p className="m-mega-fine">{LANDLORD_FINE_PRINT}</p>
      <button type="submit" className="m-mega-cta" disabled={status === 'submitting'}>
        {status === 'submitting' ? 'Sending…' : cta}
        <span aria-hidden="true"> →</span>
      </button>
    </form>
  );
}

export default LandlordSignup;
