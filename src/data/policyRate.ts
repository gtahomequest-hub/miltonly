// src/data/policyRate.ts
//
// THE ONLY RATE IN THIS CODEBASE, and it is the Bank of Canada's policy
// interest rate with the date it was observed (ruling 5, 2026-09-10). Nothing
// else: no posted mortgage rate, no lender discount, no "typical" rate.
//
// WHY A DATED CONSTANT AND NOT A FETCH. A rate rendered from a live call is a
// number whose provenance a reader cannot check and a build cannot reproduce.
// This is the same shape as src/data/addressDirections.ts: an external
// authority pulled once, committed with its date, regenerated deliberately.
//
// WHAT A CONSUMER MUST DO. Render the DATE beside the rate, every time. A
// policy rate with no date is a wrong number the moment the Bank moves, and
// the Bank moves on a published schedule. A page that shows a stale rate
// silently is worse than one that shows a dated rate honestly.
//
// A POLICY RATE IS NOT A MORTGAGE RATE. It is the overnight target the Bank
// sets. A borrower is offered something else entirely. Any consumer that runs
// this through mortgage-math.ts must say so in the prose next to the figure.
//
// Source: Bank of Canada Valet API, series V39079 (target for the overnight
// rate). https://www.bankofcanada.ca/valet/observations/V39079/json?recent=1
// Re-pull that URL and update both fields together. Never one without the other.

export const BOC_POLICY_RATE = {
  /** Percent, as published. */
  ratePct: 2.25,
  /** ISO date of the observation the rate was read from. */
  observedOn: "2026-09-08",
  series: "V39079",
  sourceName: "Bank of Canada",
  sourceUrl: "https://www.bankofcanada.ca/valet/observations/V39079/json?recent=1",
} as const;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2.25% as at 8 September 2026" — the only sanctioned rendering.
 *  Formatted by hand rather than through toLocaleDateString: the served page
 *  came back "September 8, 2026" because the host's ICU data resolves en-CA
 *  differently from the local one, and a date that renders differently on
 *  different machines is drift. */
export function policyRateLabel(): string {
  const [y, m, d] = BOC_POLICY_RATE.observedOn.split("-").map(Number);
  return `${BOC_POLICY_RATE.ratePct}% as at ${d} ${MONTHS[m - 1]} ${y}`;
}
