// Server-rendered street INDEX for one neighbourhood (/neighbourhoods/[slug]/streets).
// The overflow the hub ladder (12) can't hold — but a real page, not a link dump: it opens
// with the neighbourhood's market pulse, surfaces the most-traded streets, then indexes every
// published street A–Z with its own activity signal, and ends on a wired next step. Pure
// presentation over NeighbourhoodStreetIndex; no client JS, deterministic.
import Link from "next/link";
import { config } from "@/lib/config";
import type { NeighbourhoodStreetIndex } from "@/lib/neighbourhoodStreets";

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-CA");
const CITY = config.CITY_NAME;

function letterGroups(streets: NeighbourhoodStreetIndex["streets"]) {
  const alpha = [...streets].sort((a, b) => a.name.localeCompare(b.name));
  const groups: Array<{ letter: string; rows: typeof alpha }> = [];
  for (const s of alpha) {
    const L = (s.name[0] || "#").toUpperCase();
    const g = groups[groups.length - 1];
    if (g && g.letter === L) g.rows.push(s);
    else groups.push({ letter: L, rows: [s] });
  }
  return groups;
}

export default function NeighbourhoodStreets({ data }: { data: NeighbourhoodStreetIndex }) {
  const { name, slug, streets, publishedCount, typicalPrice, sold12mo } = data;
  const mostActive = streets.filter((s) => s.soldCount > 0).slice(0, 8); // already soldCount desc
  const groups = letterGroups(streets);

  return (
    <div className="nbst">
      {/* ── hero ── */}
      <section className="nbst-hero">
        <div className="nbst-wrap">
          <nav className="nbst-crumb" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span>›</span>{" "}
            <Link href="/neighbourhoods">Neighbourhoods</Link> <span>›</span>{" "}
            <Link href={`/neighbourhoods/${slug}`}>{name}</Link> <span>›</span> <span className="nbst-crumb-here">Streets</span>
          </nav>
          <span className="nbst-eyebrow">{name} · {CITY}</span>
          <h1>
            Every street in <em>{name}</em>
          </h1>
          <p className="nbst-lede">
            All {publishedCount} {name} street{publishedCount === 1 ? "" : "s"} we publish a full guide for — each with
            its own recorded sales history. Ranked by activity, then indexed A–Z.
          </p>
          <div className="nbst-stats">
            <div className="nbst-stat">
              <div className="nbst-stat-v">{publishedCount}</div>
              <div className="nbst-stat-l">Streets guided</div>
            </div>
            <div className="nbst-stat">
              <div className="nbst-stat-v">{typicalPrice != null ? money(typicalPrice) : "—"}</div>
              <div className="nbst-stat-l">Typical sold price</div>
            </div>
            <div className="nbst-stat">
              <div className="nbst-stat-v">{sold12mo != null ? sold12mo.toLocaleString("en-CA") : "—"}</div>
              <div className="nbst-stat-l">Homes sold · 12 mo</div>
            </div>
          </div>
          <Link href={`/neighbourhoods/${slug}`} className="nbst-back">
            ← Back to the {name} guide
          </Link>
        </div>
      </section>

      {/* ── most active ── */}
      {mostActive.length > 0 && (
        <section className="nbst-block">
          <div className="nbst-wrap">
            <h2 className="nbst-h2">Most-traded streets in {name}</h2>
            <div className="nbst-active">
              {mostActive.map((s) => (
                <Link href={`/streets/${s.slug}`} className="nbst-card" key={s.slug}>
                  {s.isVip && <span className="nbst-vip">Standout</span>}
                  <div className="nbst-card-n">{s.name}</div>
                  <div className="nbst-card-m">{s.soldCount} sold · last 12 months</div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── A–Z index ── */}
      <section className="nbst-block nbst-alt">
        <div className="nbst-wrap">
          <h2 className="nbst-h2">Every {name} street, A–Z</h2>
          <p className="nbst-note">
            Each links to the street&rsquo;s own guide — every recorded sale, current listings, and how it prices.
            Streets with no sales in the last year still carry a guide.
          </p>
          <div className="nbst-index">
            {groups.map((g) => (
              <div className="nbst-lettergroup" key={g.letter}>
                <div className="nbst-letter">{g.letter}</div>
                <ul className="nbst-list">
                  {g.rows.map((s) => (
                    <li key={s.slug}>
                      <Link href={`/streets/${s.slug}`} className="nbst-link">
                        <span className="nbst-link-n">{s.name}</span>
                        <span className="nbst-link-m">
                          {s.isVip && <span className="nbst-vip-dot" aria-hidden="true">◆</span>}
                          {s.soldCount > 0 ? `${s.soldCount} sold` : "guide"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── wired next step (existing lead pipeline) ── */}
      <section className="nbst-block">
        <div className="nbst-wrap">
          <div className="nbst-cta">
            <div className="nbst-cta-k">Own a home in {name}?</div>
            <h2 className="nbst-cta-h">Know what your street is worth</h2>
            <p className="nbst-cta-p">
              A grounded valuation built on the real {name} comparables above — the number first, then the strategy.
            </p>
            <div className="nbst-cta-row">
              <Link href="/sell" className="nbst-btn nbst-btn-primary">Value my home →</Link>
              <Link href="/listings" className="nbst-btn nbst-btn-ghost">Browse live {name} listings</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
