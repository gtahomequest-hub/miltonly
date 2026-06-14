// src/components/places/PlaceDirectory.tsx
// Shared forest index template for /mosques + /schools. Server component:
// SiteNav -> breadcrumb -> hero+stats -> PlaceGrid (search+chips) -> prose ->
// hood links -> FAQ -> lead-alert CTA -> Footer. Both routes feed it their own
// data + labels; the alert form is passed in as a slot (client island).
import Link from "next/link";
import SiteNav from "@/components/nav/SiteNav";
import FooterSection from "@/components/sections/FooterSection";
import PlaceGrid from "./PlaceGrid";
import type { PlaceDirectoryProps } from "./types";
import "./places-theme.css";

export default function PlaceDirectory(props: PlaceDirectoryProps) {
  const {
    breadcrumbLabel, eyebrow, title, titleEm, subtitle, stats,
    items, filterGroups, searchPlaceholder, itemNoun, prose, hoodLinks, faqs, alert,
  } = props;

  return (
    <div className="places-v2">
      <SiteNav variant="page" />

      <div className="pl-crumb">
        <div className="pl-wrap">
          <div className="pl-crumb-row">
            <Link href="/">Home</Link>
            <span aria-hidden>›</span>
            <span className="pl-crumb-cur">{breadcrumbLabel}</span>
          </div>
        </div>
      </div>

      <section className="pl-hero">
        <div className="pl-wrap">
          <span className="pl-eyebrow">{eyebrow}</span>
          <h1>
            {title} <em>{titleEm}</em>
          </h1>
          <p className="pl-sub">{subtitle}</p>
          {stats.length > 0 && (
            <div className="pl-stats">
              {stats.map((s) => (
                <div className="pl-stat" key={s.label}>
                  <div className="pl-stat-v">{s.value}</div>
                  <div className="pl-stat-l">{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="pl-section">
        <PlaceGrid
          items={items}
          filterGroups={filterGroups}
          searchPlaceholder={searchPlaceholder}
          itemNoun={itemNoun}
        />
      </section>

      <section className="pl-section alt">
        <div className="pl-wrap pl-prose">
          <h2 className="pl-h2">{prose.heading}</h2>
          {prose.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </section>

      {hoodLinks && hoodLinks.links.length > 0 && (
        <section className="pl-section">
          <div className="pl-wrap">
            <h2 className="pl-h2">{hoodLinks.heading}</h2>
            <div className="pl-linkgrid">
              {hoodLinks.links.map((h) => (
                <Link key={h.href + h.name} href={h.href} className="pl-link">
                  <p className="pl-link-name">{h.name}</p>
                  {h.sub && <p className="pl-link-sub">{h.sub}</p>}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="pl-section alt">
        <div className="pl-wrap">
          <h2 className="pl-h2">Frequently asked questions</h2>
          <div className="pl-faq">
            {faqs.map((f, i) => (
              <div className="pl-faq-item" key={i}>
                <p className="pl-faq-q">{f.question}</p>
                <p className="pl-faq-a">{f.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pl-cta">
        <div className="pl-wrap">
          <h2>{alert.heading}</h2>
          <p>{alert.body}</p>
          {alert.form}
        </div>
      </section>

      <FooterSection />
    </div>
  );
}
