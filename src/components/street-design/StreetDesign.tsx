// src/components/street-design/StreetDesign.tsx
// MH-011: the proposed street page, drawn with fictional data for "Aamir Court". Server-rendered
// except the finder and roster island. Two review switches ride on the URL: ?palette=a|b|c picks
// the colour direction, ?view=visitor|registered picks what a signed-out or signed-in reader sees.
// In the visitor view no gated number is in the HTML at all, not merely hidden.

import type { CSSProperties } from "react";
import { config } from "@/lib/config";
import { REGISTRANT_BROKERAGE_LINE, REGISTRANT_NAME_LINE } from "@/lib/compliance/registrant";
import { VOW_BONA_FIDE_NOTICE, VOW_RELIABILITY_NOTICE, MLS_COPYRIGHT_NOTICE } from "@/lib/vowNotice";
import { OGL_MILTON_ATTRIBUTION } from "@/lib/town/roadFacts";
import FinderRoster from "./FinderRoster";
import { PALETTES, paletteVars, type PaletteKey } from "./palettes";
import {
  ADJACENT,
  CHANGES,
  FEATURES,
  HOMES,
  LISTING,
  NOTE,
  SOLD,
  STREET,
  TYPICAL,
  money,
  monthLabel,
  type Fact,
} from "./data";
import "./street-design.css";

type View = "visitor" | "registered";

export default function StreetDesign({
  palette,
  view,
  initialNumber,
  email,
}: {
  palette: PaletteKey;
  view: View;
  initialNumber?: string;
  email: string;
}) {
  const p = PALETTES[palette];
  const registered = view === "registered";
  const name = STREET.name;
  const signin = `/signin?redirect=${encodeURIComponent("/design-preview/street")}`;
  const q = (patch: Partial<{ palette: string; view: string }>) => {
    const s = new URLSearchParams({ palette, view, ...patch });
    if (initialNumber) s.set("n", initialNumber);
    return `?${s.toString()}`;
  };

  const facts: Fact[] = [
    { label: "Length", value: "410 m", note: `A closed loop off ${ADJACENT[0]}.` },
    { label: "Speed and sidewalks", value: "40 km/h", note: "Sidewalk on the odd side only." },
    { label: "Addresses", value: String(STREET.homes), note: "Numbered 1 to 42: 21 even, 21 odd." },
    { label: "Built and dwelling mix", value: STREET.buildEra, note: "About 6 in 10 homes around it are detached, 4 in 10 semi-detached (2021 Census)." },
    { label: "To Milton GO", value: "9 min drive", note: "24 min on Milton Transit Route 3, from the stop at the corner." },
    { label: "Schools", value: "2 within 1.2 km", note: "Both elementary. The secondary school is 2.6 km." },
    { label: "Park and grocery", value: "350 m to a park", note: "The nearest grocery store is 1.4 km." },
    { label: "For sale today", value: String(STREET.forSale), note: `${LISTING.number} ${name}, ${LISTING.type.toLowerCase()}.` },
    { label: "Listing age", value: `${LISTING.listedDays} days`, note: `How long ${LISTING.number} ${name} has been listed.`, gated: true },
    { label: "Sales and turnover", value: `${SOLD.length} sales`, note: "In 24 months, about 1 home in 6 a year.", gated: true },
    {
      label: "Typical sale price",
      value: TYPICAL.price ? money(TYPICAL.price) : "Too few sales",
      note: TYPICAL.priceLow && TYPICAL.priceHigh ? `The middle half sold for ${money(TYPICAL.priceLow)} to ${money(TYPICAL.priceHigh)}.` : undefined,
      gated: true,
    },
    {
      label: "Days to sell and sale to list",
      value: TYPICAL.days !== null ? `${TYPICAL.days} days` : "Too few sales",
      note: TYPICAL.saleToList !== null ? `Typical sale price was ${TYPICAL.saleToList}% of the list price.` : undefined,
      gated: true,
    },
    { label: "Basement mentions", value: `9 of ${SOLD.length}`, note: "Sold listings that mention a finished basement.", gated: true },
    { label: "Builder mentions", value: `5 of ${SOLD.length}`, note: "Sold listings that name the builder, Brookvale Homes.", gated: true },
  ];
  const publicCount = facts.filter((f) => !f.gated).length;
  const gatedCount = facts.length - publicCount;

  const changes = CHANGES.filter((c) => registered || !c.registeredOnly);
  const maxFeature = Math.max(...FEATURES.map((f) => f.count));

  return (
    <div className={`sd sd-p-${palette}`} style={paletteVars(p) as CSSProperties} data-palette={palette} data-view={view}>
      {/* Review tooling, not part of the design. */}
      <nav className="sd-review" aria-label="Design preview switches">
        <span className="sd-review-tag">Design preview · fictional data</span>
        <span className="sd-review-group">
          Palette
          {(Object.keys(PALETTES) as PaletteKey[]).map((k) => (
            <a key={k} href={q({ palette: k })} aria-current={k === palette ? "true" : undefined}>
              {k.toUpperCase()} {PALETTES[k].name}
            </a>
          ))}
        </span>
        <span className="sd-review-group">
          View
          {(["visitor", "registered"] as View[]).map((v) => (
            <a key={v} href={q({ view: v })} aria-current={v === view ? "true" : undefined}>
              {v === "visitor" ? "Visitor" : "Registered"}
            </a>
          ))}
        </span>
      </nav>

      {/* 1. Header */}
      <header className="sd-header">
        <div className="sd-wrap sd-header-in">
          <a className="sd-logo" href="/">
            Miltonly
          </a>
          {/* The registrant line MC-047 asks of every header, 14px or larger. This preview draws its own
              header; the page that ships renders RegistrantStrip or adds this header to the
              marks scripts/test-vow-branding.ts accepts. */}
          <p className="sd-registrant" data-registrant>
            <span data-registrant-name>{REGISTRANT_NAME_LINE}</span> · <span data-registrant-brokerage>{REGISTRANT_BROKERAGE_LINE}</span>
          </p>
        </div>
      </header>

      <main>
        {/* 2. Hero */}
        <section className="sd-hero" aria-labelledby="sd-h1">
          <div className="sd-wrap sd-hero-in">
            <HeroArt />
            <nav className="sd-crumbs" aria-label="Breadcrumb">
              <a href="/streets">Milton streets</a>
              <span aria-hidden="true">/</span>
              <a href="/neighbourhoods">{STREET.neighbourhood}</a>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{name}</span>
            </nav>
            <h1 id="sd-h1">{name}</h1>
            <p className="sd-lede">
              A closed loop of {STREET.homes} homes in {STREET.neighbourhood}, Milton, backing onto the trail on its odd side.
            </p>
            <ul className="sd-chips" aria-label="At a glance">
              <li>{STREET.homes} homes</li>
              <li className="sd-chip-live">
                <span className="sd-dot" aria-hidden="true" />
                {STREET.forSale} for sale today
              </li>
              <li>Built mostly {STREET.buildEra} (2021 Census)</li>
            </ul>
            <p className="sd-updated">
              Updated <time dateTime={STREET.updatedIso}>{STREET.updated}</time>
            </p>
          </div>
        </section>

        {/* 3 and 4. Finder and roster */}
        <div className="sd-wrap sd-finder-wrap">
          <FinderRoster street={name} homes={HOMES} windowStart={STREET.windowStart} registered={registered} initial={initialNumber} />
        </div>

        {/* 5. Facts */}
        <section className="sd-section sd-wrap" aria-labelledby="sd-facts-h">
          <header className="sd-sec-head">
            <p className="sd-eyebrow">The street in numbers</p>
            <h2 id="sd-facts-h">
              {facts.length} facts about {name}
            </h2>
            <p className="sd-sec-sub">
              {publicCount} for everyone, {gatedCount} for registered readers
              {registered ? ", shown because you are signed in." : ". Registering is free."}
            </p>
          </header>
          <ol className="sd-facts">
            {facts.map((f, i) => {
              const locked = f.gated && !registered;
              return (
                <li key={f.label} className={`sd-fact${f.gated ? " is-gated" : ""}${locked ? " is-locked" : ""}`}>
                  <span className="sd-fact-n">{String(i + 1).padStart(2, "0")}</span>
                  <span className="sd-fact-label">{f.label}</span>
                  {locked ? (
                    <>
                      <span className="sd-fact-lock">
                        <LockIcon /> For registered readers
                      </span>
                      <a className="sd-fact-signin" href={signin} rel="nofollow">
                        Sign in to see it
                      </a>
                    </>
                  ) : (
                    <>
                      <span className="sd-fact-value">{f.value}</span>
                      {f.note ? <span className="sd-fact-note">{f.note}</span> : null}
                    </>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        {/* 6. For sale and for lease */}
        <section className="sd-section sd-wrap" aria-labelledby="sd-sale-h">
          <header className="sd-sec-head">
            <p className="sd-eyebrow">Today</p>
            <h2 id="sd-sale-h">For sale and for lease on {name}</h2>
          </header>
          <div className="sd-today">
            <article className="sd-listing">
              <div className="sd-listing-photo">
                <HouseArt />
                <span className="sd-listing-tag">For sale</span>
              </div>
              <div className="sd-listing-body">
                <p className="sd-listing-price">{money(LISTING.price)}</p>
                <h3 className="sd-listing-addr">
                  {LISTING.number} {name}
                </h3>
                <p className="sd-listing-spec">
                  {LISTING.beds} bed · {LISTING.baths} bath · {LISTING.type} · {LISTING.sqft}
                </p>
                <p className="sd-listing-line">{LISTING.line}</p>
                <p className="sd-listing-broker">Listing brokerage: {LISTING.brokerage}</p>
                <a className="sd-textlink" href="/listings">
                  See the listing
                </a>
              </div>
            </article>
            <div className="sd-lease-empty">
              <h3>For lease</h3>
              <p>No home on {name} is for lease today.</p>
              <a className="sd-textlink" href="#actions">
                Watch this street to hear when one is
              </a>
            </div>
          </div>
        </section>

        {/* 7. What changed */}
        <section className="sd-section sd-wrap" aria-labelledby="sd-changed-h">
          <header className="sd-sec-head">
            <p className="sd-eyebrow">Recent</p>
            <h2 id="sd-changed-h">What changed on this street</h2>
          </header>
          <ol className="sd-changes">
            {changes.map((c) => (
              <li key={c.iso + c.kind} className="sd-change">
                <time className="sd-change-date" dateTime={c.iso}>
                  {c.date}
                </time>
                <span className="sd-change-kind">{c.kind}</span>
                <span className="sd-change-text">{c.text}</span>
              </li>
            ))}
          </ol>
          {!registered ? (
            <p className="sd-changes-more">
              Sales appear here for registered readers. <a href={signin} rel="nofollow">Sign in</a>
            </p>
          ) : null}
        </section>

        {/* 8. Sold history */}
        <section className="sd-section sd-wrap" aria-labelledby="sd-sold-h">
          <header className="sd-sec-head">
            <p className="sd-eyebrow">Sold history</p>
            <h2 id="sd-sold-h">Every sale on {name} since {STREET.windowStart}</h2>
          </header>
          {registered ? (
            <div className="sd-table-wrap">
              <table className="sd-table">
                <thead>
                  <tr>
                    <th scope="col">Address</th>
                    <th scope="col">Sold</th>
                    <th scope="col" className="num">Sold price</th>
                    <th scope="col" className="num">List price</th>
                    <th scope="col" className="num">Days</th>
                    <th scope="col" className="num">Sale to list</th>
                  </tr>
                </thead>
                <tbody>
                  {SOLD.map((h) => {
                    const s = h.sale!;
                    return (
                      <tr key={h.number}>
                        <th scope="row">
                          {h.number} {name}
                          <span className="sd-table-type">{h.type}</span>
                        </th>
                        <td data-label="Sold">{monthLabel(s.month)}</td>
                        <td data-label="Sold price" className="num">
                          {money(s.price)}
                        </td>
                        <td data-label="List price" className="num">
                          {money(s.list)}
                        </td>
                        <td data-label="Days" className="num">
                          {s.days}
                        </td>
                        <td data-label="Sale to list" className="num">
                          {((s.price / s.list) * 100).toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Gate
              signin={signin}
              title="Sold history is for registered readers"
              text={`Every sale on ${name} in the last 24 months, with the sold price, the list price and the days it took. The rules of the MLS® System keep sold prices behind a free account.`}
            />
          )}
        </section>

        {/* 9. What the listings say */}
        <section className="sd-section sd-wrap" aria-labelledby="sd-say-h">
          <header className="sd-sec-head">
            <p className="sd-eyebrow">In their own words</p>
            <h2 id="sd-say-h">What the listings say</h2>
            <p className="sd-sec-sub">Features named in the listing descriptions of homes that sold here.</p>
          </header>
          {registered ? (
            <ul className="sd-features">
              {FEATURES.map((f) => (
                <li key={f.label}>
                  <span className="sd-feature-label">{f.label}</span>
                  <span className="sd-feature-bar" aria-hidden="true">
                    <span style={{ width: `${(f.count / maxFeature) * 100}%` }} />
                  </span>
                  <span className="sd-feature-count">
                    in the listings of {f.count} of {SOLD.length} sold homes
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Gate
              signin={signin}
              title="Listing features are for registered readers"
              text="How many sold homes here mention a finished basement, a double garage or a walk-out, counted from their listings."
            />
          )}
        </section>

        {/* 10. Map and video */}
        <section className="sd-section sd-wrap" aria-labelledby="sd-shape-h">
          <header className="sd-sec-head">
            <p className="sd-eyebrow">See it</p>
            <h2 id="sd-shape-h">The shape of {name}</h2>
          </header>
          <div className="sd-see">
            <figure className="sd-map">
              <StreetMap />
              <figcaption>
                Even numbers on the west side, odd on the east, backing onto the trail. {LISTING.number} is for sale.
              </figcaption>
            </figure>
            <figure className="sd-video">
              <a className="sd-video-poster" href="#video" aria-label={`Play the street video of ${name}, ${STREET.videoLength}`}>
                <VideoArt />
                <span className="sd-play" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="22" height="22">
                    <path d="M8 5v14l11-7z" fill="currentColor" />
                  </svg>
                </span>
                <span className="sd-video-len">{STREET.videoLength}</span>
              </a>
              <figcaption>
                <strong>A drive down {name}</strong>
                <span>Filmed {STREET.videoFilmed}, on a weekday morning.</span>
              </figcaption>
            </figure>
          </div>
        </section>

        {/* 11. Aamir's note */}
        <section className="sd-section sd-wrap" aria-labelledby="sd-note-h">
          <div className="sd-note">
            <h2 id="sd-note-h" className="sd-eyebrow">
              A note from {config.realtor.name.split(" ")[0]}
            </h2>
            <blockquote>
              {NOTE.lines.map((l) => (
                <p key={l}>{l}</p>
              ))}
            </blockquote>
            <p className="sd-note-sign">
              <span className="sd-avatar" aria-hidden="true">
                AY
              </span>
              <span>
                <strong>{config.realtor.name}</strong>
                <span>
                  {config.realtor.title}, <time dateTime="2026-09-28">{NOTE.date}</time>
                </span>
              </span>
            </p>
          </div>
        </section>

        {/* 12. Actions */}
        <section className="sd-section sd-wrap" id="actions" aria-labelledby="sd-actions-h">
          <header className="sd-sec-head">
            <p className="sd-eyebrow">Next</p>
            <h2 id="sd-actions-h">What you can do from here</h2>
          </header>
          <div className="sd-actions">
            <div className="sd-action">
              <h3>Home report</h3>
              <p>What a home on {name} would sell for today, drawn from this street&rsquo;s sales and listings.</p>
              <a className="sd-btn sd-btn-cta" href="#actions">
                Get the home report
              </a>
            </div>
            <div className="sd-action">
              <h3>Watch this street</h3>
              <p>One email when a home here is listed, sells or changes its price. Nothing else.</p>
              <a className="sd-btn sd-btn-solid" href="#actions">
                Watch {name}
              </a>
            </div>
            <div className="sd-action">
              <h3>Book a call</h3>
              <p>Fifteen minutes with {config.realtor.name}, about this street or your move.</p>
              <a className="sd-btn sd-btn-line" href="/book">
                Book a call
              </a>
            </div>
          </div>
        </section>

        {/* 13. Links */}
        <section className="sd-section sd-wrap sd-links" aria-labelledby="sd-links-h">
          <h2 id="sd-links-h" className="sd-eyebrow">
            Around {name}
          </h2>
          <div className="sd-links-grid">
            <div>
              <h3>Neighbourhood</h3>
              <a href="/neighbourhoods">{STREET.neighbourhood}</a>
            </div>
            <div>
              <h3>Streets next to it</h3>
              {ADJACENT.map((s) => (
                <a key={s} href="/streets">
                  {s}
                </a>
              ))}
            </div>
            <div>
              <h3>Lists</h3>
              <a href="/listings">Homes for sale in Milton</a>
              <a href="/sold">Sold prices in Milton</a>
              <a href="/streets">Every street in Milton</a>
              <a href="/schools">Schools in Milton</a>
            </div>
          </div>
        </section>
      </main>

      {/* 14. Footer */}
      <footer className="sd-footer">
        <div className="sd-wrap">
          <div className="sd-footer-top">
            <div>
              <p className="sd-footer-name">{REGISTRANT_NAME_LINE}</p>
              <p>{REGISTRANT_BROKERAGE_LINE}</p>
              <p>
                <a href={`mailto:${email}`}>{email}</a> · <a href={`tel:${config.realtor.phoneE164}`}>{config.realtor.phone}</a>
              </p>
            </div>
            <nav className="sd-footer-links" aria-label="Footer">
              <a href="#sources">Sources</a>
              <a href={`mailto:${email}?subject=${encodeURIComponent(`Error on ${name}`)}`}>Report an error</a>
              <a href="/terms">VOW Terms of Use</a>
              <a href="/privacy">Privacy</a>
            </nav>
          </div>
          <div className="sd-footer-legal">
            <p id="sources">
              <strong>Sources.</strong> Addresses, street length, speed and sidewalks: the Town of Milton&rsquo;s open data. Build era and
              dwelling mix: Statistics Canada, 2021 Census. Listings and sales: the PropTx MLS® System. Travel times: Milton Transit and
              GO Transit schedules.
            </p>
            <p>{VOW_BONA_FIDE_NOTICE}</p>
            <p>{VOW_RELIABILITY_NOTICE}</p>
            <p>
              {MLS_COPYRIGHT_NOTICE()} © {new Date().getFullYear()} Miltonly. {OGL_MILTON_ATTRIBUTION}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Gate({ signin, title, text }: { signin: string; title: string; text: string }) {
  return (
    <div className="sd-gate">
      <LockIcon />
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
        <div className="sd-gate-actions">
          <a className="sd-btn sd-btn-cta" href={signin} rel="nofollow">
            Register free
          </a>
          <a className="sd-textlink" href={signin} rel="nofollow">
            I have an account
          </a>
        </div>
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg className="sd-lock" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

/** A schematic of the loop: even lots west, odd lots east, the trail behind the odd side. */
function StreetMap() {
  const lots = Array.from({ length: 21 }, (_, i) => i);
  const top = 96;
  const step = 14.2;
  return (
    <svg viewBox="0 0 340 460" role="img" aria-label="Map of Aamir Court: a straight street with a turning circle at its north end, 21 lots on each side">
      <rect width="340" height="460" fill="var(--sd-paper)" />
      {/* trail */}
      <path d="M300 30 C 310 150, 290 300, 305 440" fill="none" stroke="var(--sd-accent)" strokeWidth="3" strokeDasharray="6 6" />
      <text x="314" y="250" className="sd-map-label" transform="rotate(90 314 250)" textAnchor="middle">
        Trail
      </text>
      {/* park */}
      <rect x="226" y="18" width="60" height="44" rx="8" fill="var(--sd-support-tint)" />
      <text x="256" y="45" className="sd-map-label" textAnchor="middle">
        Park
      </text>
      {/* road */}
      <rect x="146" y="80" width="40" height="350" fill="var(--sd-line)" />
      <circle cx="166" cy="66" r="42" fill="var(--sd-line)" />
      <rect x="20" y="420" width="300" height="34" fill="var(--sd-line)" />
      <text x="170" y="443" className="sd-map-label" textAnchor="middle">
        {ADJACENT[0]}
      </text>
      <text x="166" y="260" className="sd-map-road" textAnchor="middle" transform="rotate(-90 166 260)">
        Aamir Court
      </text>
      {/* lots */}
      {lots.map((i) => {
        const y = 404 - (i + 1) * step;
        const even = 2 * (i + 1);
        const odd = 2 * i + 1;
        return (
          <g key={i}>
            <rect x="70" y={y} width="68" height={step - 2} rx="2" fill="var(--sd-paper)" stroke="var(--sd-muted)" strokeWidth="0.8" />
            <rect
              x="194"
              y={y}
              width="68"
              height={step - 2}
              rx="2"
              fill={odd === LISTING.number ? "var(--sd-support)" : "var(--sd-paper)"}
              stroke={odd === LISTING.number ? "var(--sd-support)" : "var(--sd-muted)"}
              strokeWidth="0.8"
            />
            {even === 2 || even === 42 ? (
              <text x="60" y={y + 11} className="sd-map-num" textAnchor="end">
                {even}
              </text>
            ) : null}
            {odd === 1 || odd === 41 ? (
              <text x="272" y={y + 11} className="sd-map-num">
                {odd}
              </text>
            ) : null}
            {odd === LISTING.number ? (
              <text x="272" y={y + 11} className="sd-map-num sd-map-hot">
                {odd}
              </text>
            ) : null}
          </g>
        );
      })}
      <text x="20" y={top - 60} className="sd-map-label">
        N ↑
      </text>
    </svg>
  );
}

/** The loop drawn as a line, one tick per address, the listed home as a filled dot. */
function HeroArt() {
  const ticks = Array.from({ length: 21 }, (_, i) => 280 - i * 9.2);
  return (
    <svg className="sd-hero-art" viewBox="0 0 300 300" aria-hidden="true">
      <path d="M150 290 V 86" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.9" />
      <circle cx="150" cy="56" r="30" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.9" />
      {ticks.map((y) => (
        <g key={y} opacity="0.55">
          <line x1="120" x2="138" y1={y} y2={y} stroke="currentColor" strokeWidth="2" />
          <line x1="162" x2="180" y1={y} y2={y} stroke="currentColor" strokeWidth="2" />
        </g>
      ))}
      <circle cx="190" cy={280 - 8 * 9.2} r="6" fill="currentColor" />
    </svg>
  );
}

function HouseArt() {
  return (
    <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="400" height="240" fill="var(--sd-support-tint)" />
      <rect y="180" width="400" height="60" fill="var(--sd-line)" />
      <path d="M90 120 L180 60 L270 120 Z" fill="var(--sd-forest)" />
      <rect x="104" y="118" width="152" height="70" fill="var(--sd-paper)" />
      <path d="M200 110 L280 58 L350 110 Z" fill="var(--sd-forest-soft)" />
      <rect x="212" y="108" width="126" height="80" fill="var(--sd-paper)" />
      <rect x="126" y="134" width="30" height="26" fill="var(--sd-accent)" opacity="0.35" />
      <rect x="196" y="134" width="30" height="26" fill="var(--sd-accent)" opacity="0.35" />
      <rect x="230" y="150" width="46" height="38" fill="var(--sd-muted)" opacity="0.4" />
      <rect x="292" y="134" width="30" height="26" fill="var(--sd-accent)" opacity="0.35" />
      <circle cx="46" cy="160" r="28" fill="var(--sd-accent)" opacity="0.55" />
      <circle cx="372" cy="150" r="32" fill="var(--sd-accent)" opacity="0.45" />
    </svg>
  );
}

function VideoArt() {
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="320" height="180" fill="var(--sd-forest)" />
      <rect width="320" height="92" fill="var(--sd-forest-soft)" />
      <path d="M130 92 L190 92 L300 180 L20 180 Z" fill="#2b4a40" />
      <path d="M158 100 L162 100 L166 124 L154 124 Z M152 136 L168 136 L172 164 L148 164 Z" fill="var(--sd-support-on-dark)" opacity="0.8" />
      <path d="M20 92 L70 60 L120 92 Z" fill="#1d5a47" />
      <rect x="34" y="90" width="72" height="30" fill="#24604c" />
      <path d="M200 92 L250 62 L300 92 Z" fill="#1d5a47" />
      <rect x="212" y="90" width="76" height="30" fill="#24604c" />
      <circle cx="12" cy="120" r="18" fill="#12503c" />
      <circle cx="310" cy="118" r="20" fill="#12503c" />
    </svg>
  );
}
