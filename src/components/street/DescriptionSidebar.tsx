import Link from "next/link";
import type { DescriptionSidebarProps } from "@/types/street";

export function DescriptionSidebar({
  streetFacts,
  nearbyPlaces,
  sidebarCTA,
}: DescriptionSidebarProps) {
  return (
    <aside className="description-sidebar">
      <div className="sidebar-meta">Street facts</div>
      <dl className="sidebar-facts">
        {Object.entries(streetFacts).map(([k, v]) => (
          <Fact key={k} term={k} definition={v} />
        ))}
      </dl>

      <div className="sidebar-meta">Nearby</div>
      <div className="places-list">
        {nearbyPlaces.map((p, i) => {
          const inner = (
            <>
              <span className="place-link-icon" aria-hidden>{p.icon || "•"}</span>
              <div className="place-link-body">
                <div className="place-link-name">{p.name}</div>
                <div className="place-link-meta">{p.category} · {p.distance}</div>
              </div>
              <span className="place-link-arrow" aria-hidden>→</span>
            </>
          );
          return p.href ? (
            <Link key={i} href={p.href} className="place-link">{inner}</Link>
          ) : (
            <div key={i} className="place-link">{inner}</div>
          );
        })}
      </div>

      <div className="sidebar-cta dot-shift-bg-strong">
        <div className="sidebar-cta-label">{sidebarCTA.eyebrow}</div>
        <div className="sidebar-cta-headline">{sidebarCTA.headline}</div>
        <div className="sidebar-cta-body">{sidebarCTA.body}</div>
        <Link href={sidebarCTA.actionHref} className="sidebar-cta-action">
          {sidebarCTA.actionLabel}
          <span aria-hidden>→</span>
        </Link>
        {sidebarCTA.trustLine && <div className="sidebar-cta-trust">{sidebarCTA.trustLine}</div>}
      </div>
    </aside>
  );
}

function Fact({ term, definition }: { term: string; definition: string }) {
  return (
    <>
      <dt>{term}</dt>
      <dd>{definition}</dd>
    </>
  );
}

