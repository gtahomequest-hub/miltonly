import { Container, DotShiftBg, SerifHeading, Eyebrow } from "@/components/ui";
import type { AtAGlanceGridProps } from "@/types/street";

export function AtAGlanceGrid({ tiles }: AtAGlanceGridProps) {
  return (
    <section id="s5" className="border-b" style={{ paddingTop: 96, paddingBottom: 96, borderColor: "var(--line)" }}>
      <Container>
        <Eyebrow color="blue" size="lg" className="block mb-3">At a glance</Eyebrow>
        <SerifHeading level={2}>
          A dozen details that <em>shape the picture</em>
        </SerifHeading>
        <DotShiftBg variant="subtle">
          <div className="glance-grid">
            {tiles.map((t, i) => (
              <div key={i} className="glance-tile">
                <span className="label">{t.label}</span>
                <span className="value">{t.value}</span>
                {t.detail && <span className="detail">{t.detail}</span>}
              </div>
            ))}
          </div>
        </DotShiftBg>
      </Container>
    </section>
  );
}

