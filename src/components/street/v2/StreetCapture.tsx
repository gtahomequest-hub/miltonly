'use client';

// THE CAPTURE UNDER THE HERO (MH-005, MA-001 change 4).
//
// The only field on the street page sat at screen 13 to 33 on a phone, and every seller CTA
// before it was a link to /sell, a second page load with four required fields, most of them
// dropping the street on the way. This is one field, in the first two screens, for the two
// intents the page already has: the owner who wants the written valuation and the watcher who
// wants an email when a home here is listed for sale (the matcher reads new listings only, ML-004). Both post through the one lead helper
// with the street as `property_address`, so the seller path never leaves the page; /sell
// stays for the long form, and every link to it now carries ?street=.
//
// Two sources, one per intent: "street-valuation" (new, the lead path's confirmation is the
// valuation's) and "street-alert" (the existing street watch, kind `street`). The segmented
// control is two radio inputs, so the form is one form and a keyboard walks it.
import { useId, useState } from 'react';
import { postLead, honeypotInputProps, HONEYPOT_WRAPPER_STYLE } from '@/lib/postLeadClient';
import { ALERT_FINE_PRINT, VALUATION_FINE_PRINT } from '@/lib/lead/finePrint';

type Intent = 'value' | 'watch';

export function StreetCapture({ streetName, neighbourhood, sellHref }: { streetName: string; neighbourhood: string; sellHref: string }) {
  const id = useId();
  const [intent, setIntent] = useState<Intent>('value');
  const [email, setEmail] = useState('');
  const [honey, setHoney] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'ok' | 'error'>('idle');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || status === 'submitting') return;
    setStatus('submitting');
    const ok =
      intent === 'value'
        ? await postLead({
            source: 'street-valuation',
            intent: 'sell',
            email,
            property_address: streetName,
            neighbourhood,
            notes: `Written valuation requested from the street page, ${streetName}`,
            consentText: VALUATION_FINE_PRINT,
            consentTimestamp: new Date().toISOString(),
            honeypot: honey,
          })
        : await postLead({
            source: 'street-alert',
            intent: 'buy',
            email,
            property_address: streetName,
            neighbourhood,
            notes: `Street alerts requested, ${streetName} (hero)`,
            consentText: ALERT_FINE_PRINT,
            consentTimestamp: new Date().toISOString(),
            honeypot: honey,
          });
    setStatus(ok ? 'ok' : 'error');
  };

  if (status === 'ok') {
    return (
      <div className="s-capture" id="capture">
        <p className="s-capture-done">
          {intent === 'value'
            ? `Your request is in. Aamir prepares the valuation by hand from the comparable sales on ${streetName} and emails it within one business day.`
            : `You are watching ${streetName}. One email when a home here is listed for sale, and nothing else.`}
        </p>
      </div>
    );
  }

  return (
    <form className="s-capture" id="capture" onSubmit={submit} aria-labelledby={`${id}-h`}>
      <div className="s-capture-head">
        <span id={`${id}-h`} className="s-capture-h">
          {intent === 'value' ? `Own on ${streetName}?` : `Watch ${streetName}`}
        </span>
        <div className="s-capture-seg" role="radiogroup" aria-label="What do you want">
          <label className={intent === 'value' ? 's-on' : ''}>
            <input type="radio" name={`${id}-intent`} value="value" checked={intent === 'value'} onChange={() => setIntent('value')} />
            Value my home
          </label>
          <label className={intent === 'watch' ? 's-on' : ''}>
            <input type="radio" name={`${id}-intent`} value="watch" checked={intent === 'watch'} onChange={() => setIntent('watch')} />
            Watch the street
          </label>
        </div>
      </div>
      <p className="s-capture-p">
        {intent === 'value'
          ? `A written valuation from the comparable sales on ${streetName}, prepared by hand and sent by email. Nothing on this page estimates a single address.`
          : `An email when a home on ${streetName} is listed for sale. Nothing else, and no account.`}
      </p>
      <div className="s-capture-row">
        <input
          id={`${id}-email`}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          autoComplete="email"
          aria-label={intent === 'value' ? `Email for your ${streetName} valuation` : `Email for ${streetName} alerts`}
        />
        <button type="submit" disabled={status === 'submitting'}>
          {status === 'submitting' ? '…' : intent === 'value' ? 'Get the valuation' : 'Watch the street'}
        </button>
      </div>
      {/* Honeypot. A person never sees it; a bot fills it and the row is silently dropped. */}
      <div style={HONEYPOT_WRAPPER_STYLE} aria-hidden="true">
        <label>
          Company website
          <input {...honeypotInputProps} type="text" value={honey} onChange={(e) => setHoney(e.target.value)} />
        </label>
      </div>
      {status === 'error' ? <div className="s-alert-err">Something went wrong. Please try again.</div> : null}
      <div className="s-capture-fine">
        {intent === 'value' ? VALUATION_FINE_PRINT : ALERT_FINE_PRINT}
        {intent === 'value' ? (
          <>
            {' '}
            Prefer the full form? <a href={sellHref}>Add your address and phone</a>.
          </>
        ) : null}
      </div>
    </form>
  );
}

export default StreetCapture;
