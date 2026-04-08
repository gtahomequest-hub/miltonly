export function formatPrice(price: number): string {
  if (price >= 1000000) {
    const m = price / 1000000;
    return "$" + (m % 1 === 0 ? m.toFixed(0) : m.toFixed(2)) + "M";
  }
  if (price >= 1000) {
    return "$" + Math.round(price / 1000) + "K";
  }
  return "$" + price.toLocaleString();
}

export function formatPriceFull(price: number): string {
  return "$" + price.toLocaleString();
}

export function daysAgo(date: Date): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}
