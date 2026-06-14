// src/components/places/PlaceDetail.tsx
// Shared forest detail template for /mosques/[slug] + /schools/[slug]. Server
// component: SiteNav -> breadcrumb -> hero (badge/title/meta/chips/highlight +
// stat tiles) -> price-by-type band -> nearby listings (slot) -> nearby streets
// -> siblings -> FAQ -> CTA -> Footer. Domain-specific fields (Fraser, services)
// are typed props, not hardcoded into the shell.
import Link from "next/link";
import SiteNav from "@/components/nav/SiteNav";
import FooterSection from "@/components/sections/FooterSection";
import { config } from "@/lib/config";
import type { PlaceDetailProps } from "./types";
import "./places-theme.css";

export default function PlaceDetail(props: PlaceDetailProps) {
  const {
    breadcrumb, badge, heroEyebrow, title, metaLine, highlight, serviceChips,
    stats, byType, listingsHeading, listings, streetsHeading, streets,
    siblingsHeading, siblings, faqs, cta,
  } = props;

  const firstName = config.realtor.name.split(" ")[0];

  return (
    <div className="places-v2">
      <SiteNav variant="page" />

      <div className="pl-crumb">
        <div className="pl-wrap">
          <div className="pl-crumb-row">
            {breadcrumb.map((c, i) => (
              <span key={i} style={{ display: "contents" }}>
                {c.href ? <Link href={c.href}>{c.label}</Link> : <span className="pl-crumb-cur">{c.label}</span>}
                {i < breadcrumb.length - 1 && <span aria-hidden>›</span>}
              </span>
            ))}
          </div>
        </div>
      </div>

      <section className="pl-hero">
        <div className="pl-wrap pl-hero-grid">
          <div className="pl-hero-main">
            <div className="pl-badgerow">
              <span className={`pl-badge ${badge.tone ?? ""}`}>{badge.label}</span>
              <span className="pl-hero-eyebrow">{heroEyebrow}</span>
            </div>
            <h1>{title}</h1>
            <p className="pl-hero-meta">{metaLine}</p>
            {highlight && <span className="pl-highlight">{highlight}</span>}
            {serviceChips && serviceChips.length > 0 && (
              <div className="pl-chiprow">
                {serviceChips.map((s) => (
                  <span className="pl-svc" key={s}>{s}</span>
                ))}
              </div>
            )}
          </div>
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

      {byType && byType.length > 0 && (
        <div className="pl-band">
          <div className="pl-wrap">
            {byType.map((t) => (
              <div className="pl-band-item" key={t.type}>
                <div className="pl-band-v">{t.avgPrice}</div>
                <div className="pl-band-l">{t.type} ({t.count} active)</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <section className="pl-section">
        <div className="pl-wrap">
          <h2 className="pl-h2">{listingsHeading}</h2>
          {listings}
        </div>
      </section>

      {streets.length > 0 && (
        <section className="pl-section alt">
          <div className="pl-wrap">
            <h2 className="pl-h2">{streetsHeading}</h2>
            <div className="pl-linkgrid">
              {streets.map((s) => (
                <Link key={s.href} href={s.href} className="pl-link">
                  <p className="pl-link-name">{s.name}</p>
                  {s.price && <p className="pl-link-price">{s.price}</p>}
                  {s.sub && <p className="pl-link-sub">{s.sub}</p>}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {siblings.length > 0 && (
        <section className="pl-section">
          <div className="pl-wrap">
            <h2 className="pl-h2">{siblingsHeading}</h2>
            <div className="pl-linkgrid">
              {siblings.map((s) => (
                <Link key={s.href} href={s.href} className="pl-link">
                  <p className="pl-link-name">
                    {s.name}
                    {s.badge && <span className={`pl-badge ${s.badge.tone ?? ""}`} style={{ marginLeft: 8 }}>{s.badge.label}</span>}
                  </p>
                  {s.sub && <p className="pl-link-sub">{s.sub}</p>}
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
          <h2>{cta.heading}</h2>
          <p>{cta.body}</p>
          <div className="pl-cta-btns">
            <a href={`tel:${config.realtor.phoneE164}`} className="pl-btn pl-btn-primary">
              Call {firstName}
            </a>
            <Link href="/book" className="pl-btn pl-btn-ghost">
              Book a showing
            </Link>
          </div>
        </div>
      </section>

      <FooterSection />
    </div>
  );
}
