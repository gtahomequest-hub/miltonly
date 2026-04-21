import Link from "next/link";
import { Container, SerifHeading, Eyebrow, Body } from "@/components/ui";
import type { CommuteGridProps, CommuteCategory } from "@/types/street";

export function CommuteGrid({ categories }: CommuteGridProps) {
  return (
    <section
      id="s7"
      className="border-b"
      style={{
        paddingTop: 96,
        paddingBottom: 96,
        borderColor: "var(--line)",
        background: "var(--paper-warm)",
      }}
    >
      <Container>
        <Eyebrow color="blue" size="lg" className="block mb-3">Getting around</Eyebrow>
        <SerifHeading level={2}>
          Where <em>this street</em> reaches
        </SerifHeading>
        <Body variant="lead" className="mt-4 max-w-3xl">
          Times below assume typical traffic from mid-street. Walk and transit times use Milton Transit routing.
        </Body>

        <div className="commute-accordion">
          {categories.map((cat) => (
            <CommuteCategoryBlock key={cat.id} category={cat} />
          ))}
        </div>
      </Container>
    </section>
  );
}

function CommuteCategoryBlock({ category }: { category: CommuteCategory }) {
  return (
    <details className="commute-category" open>
      <summary>
        <span className="commute-cat-icon" aria-hidden>{category.icon}</span>
        <div>
          <div className="commute-cat-title">{category.title}</div>
          <div className="commute-cat-sub">{category.subtitle}</div>
        </div>
        <span className="commute-cat-toggle" aria-hidden>+</span>
      </summary>
      <div className="commute-cat-body">
        {category.destinations.map((d, i) => {
          const content = (
            <>
              <div className="commute-row-name">{d.name}</div>
              <div className="commute-row-times">
                <span>{d.primaryTime}</span>
                {d.secondaryTime && <span className="secondary">{d.secondaryTime}</span>}
              </div>
            </>
          );
          return (
            <div key={`${category.id}-${i}`} className="commute-row">
              {d.href ? (
                <Link href={d.href} style={{ display: "contents", textDecoration: "none" }}>
                  {content}
                </Link>
              ) : content}
            </div>
          );
        })}
      </div>
    </details>
  );
}

