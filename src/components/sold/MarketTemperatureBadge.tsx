// Always-public market temperature badge. Safe to render to anon users
// since it's a pre-computed aggregate signal, not individual record data.

type Temperature = "hot" | "warm" | "balanced" | "cool" | "cold" | null | undefined;

const TONE: Record<NonNullable<Temperature>, { label: string; bg: string; fg: string }> = {
  hot:      { label: "Hot seller's market",      bg: "bg-red-100",    fg: "text-red-800" },
  warm:     { label: "Warm seller's market",     bg: "bg-orange-100", fg: "text-orange-800" },
  balanced: { label: "Balanced market",          bg: "bg-slate-100",  fg: "text-slate-800" },
  cool:     { label: "Cool buyer's market",      bg: "bg-sky-100",    fg: "text-sky-800" },
  cold:     { label: "Cold buyer's market",      bg: "bg-blue-100",   fg: "text-blue-800" },
};

export default function MarketTemperatureBadge({ temperature }: { temperature: Temperature }) {
  if (!temperature) return null;
  const meta = TONE[temperature];
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${meta.bg} ${meta.fg}`}>
      {meta.label}
    </span>
  );
}
