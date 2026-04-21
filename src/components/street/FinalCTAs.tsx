import Link from "next/link";
import { Container, SerifHeading, Eyebrow } from "@/components/ui";
import type { FinalCTAsProps, FinalCTAData } from "@/types/street";

export function FinalCTAs({ sellerCTA, buyerCTA }: FinalCTAsProps) {
  return (
    <section
      style={{
        paddingTop: 96,
        paddingBottom: 96,
        background: "var(--navy)",
        color: "var(--paper)",
      }}
    >
      <Container>
        <Eyebrow color="gold" size="lg" className="block mb-3">Two ways forward</Eyebrow>
        <SerifHeading level={2} tone="dark">
          Your path on <em>this street</em>
        </SerifHeading>

        <div className="final-cta-grid" style={{ marginTop: 48 }}>
          <CTACard data={sellerCTA} />
          <CTACard data={buyerCTA} />
        </div>
      </Container>
    </section>
  );
}

function CTACard({ data }: { data: FinalCTAData }) {
  return (
    <div className="final-cta-card">
      <div className="label">{data.eyebrow}</div>
      <h3>{data.headline}</h3>
      <p>{data.body}</p>
      <Link href={data.actionHref} className={`final-cta-btn ${data.secondary ? "secondary" : ""}`}>
        {data.actionLabel}
      </Link>
    </div>
  );
}
