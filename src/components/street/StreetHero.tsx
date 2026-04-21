import { Container, Eyebrow, SerifHeading, StatNumber, Pill } from "@/components/ui";
import type { StreetHeroProps } from "@/types/street";
import { formatCADShort } from "@/lib/charts/theme";
import { roundPriceForProse } from "@/lib/format";

function splitLastWord(s: string): { head: string; tail: string } {
  const idx = s.lastIndexOf(" ");
  if (idx < 0) return { head: "", tail: s };
  return { head: s.slice(0, idx), tail: s.slice(idx + 1) };
}

export function StreetHero({
  eyebrow,
  streetName,
  subtitle,
  heroStats,
  productTypePills,
}: StreetHeroProps) {
  const { head, tail } = splitLastWord(streetName);

  return (
    <section className="pt-10 pb-16 border-b" style={{ borderColor: "var(--line)" }}>
      <Container>
        <Eyebrow color="blue" size="lg" className="mb-4 block">
          {eyebrow}
        </Eyebrow>
        <SerifHeading level={1}>
          {head && <>{head} </>}
          <em>{tail}</em>
        </SerifHeading>
        <p className="street-hero-subtitle">{subtitle}</p>

        {heroStats.length > 0 && (
          <div className="street-hero-stats">
            {heroStats.map((stat, i) => (
              <div key={i} className="street-hero-stat">
                <span className="mono-label mono-label-sm label" style={{ color: "var(--ink-faint)" }}>
                  {stat.label}
                </span>
                <StatNumber size="lg" className="value">{stat.value}</StatNumber>
                {stat.sub && <span className="sub">{stat.sub}</span>}
              </div>
            ))}
          </div>
        )}

        {productTypePills.map((row, i) => (
          <div key={i} className="type-pills-row">
            <div className={`type-pills-row-label dot-${row.dotColor}`}>
              <span className="dot" aria-hidden />
              {row.label}
            </div>
            <div className="type-pills">
              {row.pills.map((pill) => (
                <Pill key={`${pill.type}-${pill.anchor}`} accent={accentFor(pill.type)} href={pill.anchor}>
                  <div className="type-pill-name-block">
                    <div style={{ fontFamily: "var(--serif)", fontSize: 19, fontWeight: 600, color: "var(--navy)", letterSpacing: "-0.015em", lineHeight: 1 }}>
                      {pill.displayName}
                    </div>
                    <div className="type-pill-name-count">{pill.count} {pill.count === 1 ? "unit" : "units"}</div>
                  </div>
                  <div className="type-pill-price-block">
                    <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 500, color: pill.typicalPrice === null ? "var(--ink-faint)" : "var(--navy)", letterSpacing: "-0.02em", lineHeight: 1, whiteSpace: "nowrap" }}>
                      {pill.typicalPrice === null ? "—" : formatCADShort(roundPriceForProse(pill.typicalPrice))}
                    </div>
                    <div className="type-pill-price-label">{pill.priceLabel}</div>
                  </div>
                  <span className="type-pill-arrow" aria-hidden>→</span>
                </Pill>
              ))}
            </div>
          </div>
        ))}
      </Container>
    </section>
  );
}

function accentFor(type: StreetHeroProps["productTypePills"][number]["pills"][number]["type"]) {
  switch (type) {
    case "detached": return "navy" as const;
    case "townhouse":
    case "freehold-townhouse": return "blue" as const;
    case "semi":
    case "link": return "blue-muted" as const;
    case "condo": return "gold" as const;
  }
}

