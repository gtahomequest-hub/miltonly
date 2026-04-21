import Link from "next/link";
import type { ReactNode } from "react";
import { Container, SerifHeading, Eyebrow } from "@/components/ui";
import type { ContextCardsProps } from "@/types/street";
import { formatCADShort } from "@/lib/charts/theme";
import { roundPriceForProse } from "@/lib/format";

export function ContextCards({ similarStreets, neighbourhoods, schools }: ContextCardsProps) {
  const populated: Array<"streets" | "neighbourhoods" | "schools"> = [];
  if (similarStreets.length > 0) populated.push("streets");
  if (neighbourhoods.length > 0) populated.push("neighbourhoods");
  if (schools.length > 0) populated.push("schools");

  if (populated.length === 0) return null;

  const heading = buildHeading(populated);

  return (
    <section id="s9" className="border-b" style={{ paddingTop: 96, paddingBottom: 96, borderColor: "var(--line)" }}>
      <Container>
        <Eyebrow color="blue" size="lg" className="block mb-3">Context</Eyebrow>
        <SerifHeading level={2}>{heading}</SerifHeading>

        <div className="context-grid">
          {neighbourhoods.length > 0 && (
            <Link
              href={`/neighbourhoods/${neighbourhoods[0].slug}`}
              className="context-card"
              aria-label={`Explore ${neighbourhoods[0].name}`}
            >
              <span className="label">Neighbourhood</span>
              <h4>{neighbourhoods[0].name}</h4>
              <ul className="entries">
                {neighbourhoods.slice(0, 4).map((n) => (
                  <li key={n.slug}>{n.summary}</li>
                ))}
              </ul>
              <span className="arrow">Explore →</span>
            </Link>
          )}

          {similarStreets.length > 0 && (
            <div className="context-card">
              <span className="label">Similar streets</span>
              <h4>Others with this pattern</h4>
              <ul className="entries">
                {similarStreets.slice(0, 4).map((s) => (
                  <li key={s.slug}>
                    <Link href={`/streets/${s.slug}`} style={{ color: "var(--ink-soft)", textDecoration: "none" }}>
                      {s.name} · {formatCADShort(roundPriceForProse(s.avgPrice))} typical · {s.count} on record
                    </Link>
                  </li>
                ))}
              </ul>
              <span className="arrow">Browse streets →</span>
            </div>
          )}

          {schools.length > 0 && (
            <div className="context-card">
              <span className="label">Schools</span>
              <h4>Catchment and nearby</h4>
              <ul className="entries">
                {schools.slice(0, 4).map((s) => (
                  <li key={s.slug}>
                    <Link href={`/schools/${s.slug}`} style={{ color: "var(--ink-soft)", textDecoration: "none" }}>
                      {s.name} · {s.level} · {s.board}
                    </Link>
                  </li>
                ))}
              </ul>
              <span className="arrow">Browse schools →</span>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}

function buildHeading(populated: Array<"streets" | "neighbourhoods" | "schools">): ReactNode {
  const labels = {
    streets: "Similar streets",
    neighbourhoods: "Neighbourhoods",
    schools: "Schools",
  } as const;

  if (populated.length === 3) {
    return <>Streets, <em>neighbourhoods</em>, and schools nearby</>;
  }
  if (populated.length === 2) {
    const [a, b] = populated;
    const tail = labels[b].toLowerCase();
    return <>{labels[a]} and <em>{tail}</em> nearby</>;
  }
  // 1
  const only = populated[0];
  if (only === "schools") return <>Schools <em>nearby</em></>;
  if (only === "neighbourhoods") return <>Neighbourhoods <em>nearby</em></>;
  return <>Similar streets <em>nearby</em></>;
}
