// The fine print a lead surface shows, and the consent text the row records, as ONE string.
//
// CASL asks that express consent be recorded with what the person agreed to. The row has a
// `consentText` column for that, and ML-004 found it filled by five surfaces out of
// twenty-seven. Each of the other twenty-two showed something ("No spam. Unsubscribe
// anytime.") and sent nothing, so the brokerage's answer to "what did they consent to" was
// blank for most rows. Worse, a surface that typed its fine print in JSX and again in the
// payload could drift, and the row would then record words the visitor never saw.
//
// So the rule scripts/test-lead-forms.ts enforces at prebuild: a surface renders a named
// constant (`{ALERT_FINE_PRINT}`) and sends the same constant as `consentText`. The two
// cannot differ because they are one value. The shared ones live here; a surface whose
// disclosure is specific to it (a valuation, a market-pulse unlock) keeps its own constant
// beside its form, under the same rule.
//
// Client-safe: no server imports. config is already read by client components.

import { config } from "@/lib/config";

/** A recurring email the visitor asked for: street, building, area and price-band alerts,
 *  and the brief. Names the sender and says how it stops. */
export const ALERT_FINE_PRINT =
  `Miltonly emails only, from ${config.realtor.name} (${config.brokerage.name}). No account, unsubscribe anytime.`;

/** A request for a reply, not a subscription: a question, a viewing, a call back. */
export const REPLY_FINE_PRINT =
  `By sending, you agree that ${config.realtor.name} (${config.brokerage.name}) may reply by email, text or phone about this request. No list, no spam.`;

/** A valuation or a market read the visitor asked to receive, with follow-up. */
export const VALUATION_FINE_PRINT =
  `I agree to receive the valuation and follow-up by email, text or phone from ${config.realtor.name} (${config.brokerage.name}). I can withdraw consent anytime by replying STOP or clicking unsubscribe.`;

/** The ad landings' SMS-and-email disclosure. One sentence, so it fits under a button. */
export const SMS_EMAIL_FINE_PRINT =
  `By submitting, I consent to receive SMS and email from ${config.realtor.name}, ${config.brokerage.name}. Reply STOP to opt out.`;
