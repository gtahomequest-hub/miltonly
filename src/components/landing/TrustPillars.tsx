import { Trophy, MapPin, Clock } from "lucide-react";
import { config } from "@/lib/config";

export interface TrustPillarsProps {
  /** Variant for layout — "horizontal" (default, wraps as flex row) or "stacked" (vertical column). */
  variant?: "horizontal" | "stacked";
  /** Optional className for outer wrapper. */
  className?: string;
}

export default function TrustPillars({
  variant = "horizontal",
  className = "",
}: TrustPillarsProps) {
  const layoutClass =
    variant === "stacked"
      ? "flex flex-col items-start gap-2 sm:gap-2.5"
      : "flex flex-wrap gap-2 sm:gap-2.5";

  const wrapperClass = className
    ? `${layoutClass} ${className}`
    : `${layoutClass} mb-4 sm:mb-0`;

  return (
    <div className={wrapperClass}>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f59e0b]/40 bg-[#f59e0b]/10 px-3 py-1.5 text-[11px] sm:text-[12px] font-semibold text-[#fbbf24]">
        <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden />
        RE/MAX Hall of Fame
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1e3a5f] bg-[#0c1e35] px-3 py-1.5 text-[11px] sm:text-[12px] font-semibold text-[#cbd5e1]">
        <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden />
        {config.realtor.yearsExperience} years · $55M+ in {config.CITY_NAME}
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-[11px] sm:text-[12px] font-semibold text-green-300">
        <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden />
        Replies in &lt;60 min
      </span>
    </div>
  );
}
