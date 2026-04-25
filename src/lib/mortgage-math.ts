/**
 * Canadian mortgage math utilities.
 * Used by the homepage MortgageCalculator and any future broker/lead pages.
 */

/** Canadian monthly payment with semi-annual compounding */
export function monthlyPayment(principal: number, annualRatePct: number, years: number): number {
  if (principal <= 0 || annualRatePct <= 0 || years <= 0) return 0;
  const r = annualRatePct / 100;
  const monthlyRate = Math.pow(1 + r / 2, 2 / 12) - 1;
  const n = years * 12;
  return principal * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -n)));
}

/** Ontario Land Transfer Tax (marginal brackets, residential) */
export function ontarioLTT(price: number): number {
  if (price <= 0) return 0;
  const brackets: [number, number][] = [
    [55000, 0.005],
    [250000, 0.01],
    [400000, 0.015],
    [2000000, 0.02],
    [Number.POSITIVE_INFINITY, 0.025],
  ];
  let tax = 0;
  let prev = 0;
  for (const [cap, rate] of brackets) {
    const taxable = Math.max(0, Math.min(price, cap) - prev);
    tax += taxable * rate;
    prev = cap;
    if (price <= cap) break;
  }
  return Math.round(tax);
}

/** CMHC insurance premium (charged when down payment < 20%) */
export function cmhcPremium(price: number, downPaymentPct: number): number {
  if (downPaymentPct >= 20) return 0;
  const loan = price * (1 - downPaymentPct / 100);
  let rate = 0;
  if (downPaymentPct >= 15) rate = 0.028;
  else if (downPaymentPct >= 10) rate = 0.031;
  else rate = 0.04;
  return Math.round(loan * rate);
}

/** Canadian B-20 stress test rate */
export function stressTestRate(headlineRate: number): number {
  return Math.max(headlineRate + 2, 5.25);
}

export function formatMoney(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-CA");
}

export function formatMoneyShort(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}K`;
  return formatMoney(n);
}
