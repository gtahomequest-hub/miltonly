"use client";
// Build B — the /condos/[slug] building page. Renders ONLY the Build A payload
// (buildBuildingAttributes), reframed through a Buyer<->Seller lens. No new data reads, no
// per-unit prices, k-gated medians only. Honest degradation is designed in, driven by kFloors.
import { useState } from "react";
import "./condo-theme.css";
import "./condo-b.css";
import type { BuildingAttributes } from "@/lib/ai/buildingAttributes.types";
import { SiteNav } from "../nav/SiteNav";
import { config } from "@/lib/config";
import { formatPrice } from "@/lib/format";

type Attrs = Omit<BuildingAttributes, "_debug">;
type Lens = "buyer" | "seller";

const money = (n: number | null) => (n == null ? "—" : formatPrice(n));
const rent = (n: number | null) => (n == null ? "—" : `$${Math.round(n).toLocaleString("en-CA")}`);
const Word = ({ children }: { children: React.ReactNode }) => <em className="cb-lensword">{children}</em>;

function positioning(a: Attrs): string {
  if (a.kFloors.identityOnly) return "New to the record — too few recent trades in this building to show its own numbers yet, so here's what the surrounding market says.";
  if (!a.kFloors.saleTypical && a.kFloors.leaseTypical) return "A rental-forward building — it changes hands quietly, but it rarely sits empty.";
  if (a.gyield.headlinePct != null) return "A dual-market building — owner-occupiers and investors both compete for the same units here.";
  if (a.kFloors.saleTypical && !a.kFloors.saleRange) return "Priced with confidence — enough recent sales to know the typical number, if not yet the full range.";
  return "A Milton condo building, told entirely through its own recorded sales and leases.";
}

export default function BuildingAttributesPage({ attrs }: { attrs: Attrs }) {
  const [lens, setLens] = useState<Lens>("buyer");
  const a = attrs;
  const name = a.buildingName.name;
  const nbhd = a.areaContext.neighbourhoodName ?? "Milton";
  const buyer = lens === "buyer";
  const hasBridge = a.records.total > 1 && (a.records.saleAll > 0 || a.records.leaseAll > 0);

  // ---- hero headline stat (adapts to what the building can honestly show) ----
  let hNum = "—", hUnit = "", hCap = "";
  let hRead: React.ReactNode = null;
  if (a.kFloors.saleTypical && a.gyield.saleMedian != null) {
    hNum = money(a.gyield.saleMedian); hCap = "typical sale price · past 12 months";
    hRead = buyer
      ? <>What it takes to get in. This is <Word>your entry</Word> to {name} — a real number, not an asking price.</>
      : <>The market&rsquo;s read on your building. <Word>Your number</Word> starts here, set by actual closings.</>;
  } else if (a.kFloors.leaseTypical && a.gyield.leaseMedian != null) {
    hNum = rent(a.gyield.leaseMedian); hUnit = "/mo"; hCap = "typical rent · past 12 months";
    hRead = buyer
      ? <>Sales are quiet here — fewer than five in a year, so we don&rsquo;t publish a typical price. But it&rsquo;s a <Word>busy rental</Word> building.</>
      : <>Under five recent sales, so the market hasn&rsquo;t fixed a price — which makes <Word>rental demand</Word> your strongest lever.</>;
  } else if (a.areaContext.typicalCondo != null) {
    hNum = money(a.areaContext.typicalCondo); hCap = `typical condo · ${nbhd}`;
    hRead = <>Not enough recent trades in this building yet. Here&rsquo;s what the <Word>surrounding market</Word> says.</>;
  } else {
    hNum = "New"; hCap = "on the record";
    hRead = <>We&rsquo;re watching this building. As it trades, its own numbers will appear here.</>;
  }

  return (
    <div className="condo-v2">
      <SiteNav variant="page" />
      <div className="cb">
        {/* ---------------- HERO ---------------- */}
        <header className="cb-hero">
          <div className="c-wrap">
            <nav className="cb-crumb">
              <a href={config.SITE_URL}>Home</a> &nbsp;/&nbsp; <a href="/condos">Condos</a> &nbsp;/&nbsp; {name}
            </nav>
            <div className="cb-eyebrow">{config.CITY_NAME} condo building</div>
            <h1 className="cb-title">{name}</h1>
            <p className="cb-sub">{positioning(a)}</p>

            <div className="cb-lens" data-lens={lens} role="group" aria-label="Read this building as a buyer or a seller">
              <span className="cb-lens-thumb" aria-hidden />
              <button type="button" className="cb-lens-btn" aria-pressed={buyer} onClick={() => setLens("buyer")}>I&rsquo;m buying</button>
              <button type="button" className="cb-lens-btn" aria-pressed={!buyer} onClick={() => setLens("seller")}>I&rsquo;m selling</button>
            </div>

            <div className="cb-headline">
              <div>
                <div className="cb-hstat-num">{hNum}{hUnit && <span className="cb-unit">{hUnit}</span>}</div>
                <div className="cb-hstat-cap">{hCap}</div>
              </div>
              <div className="cb-hstat-read cb-swap">{hRead}</div>
            </div>
          </div>
        </header>

        {/* ---------------- THE TWO MARKETS ---------------- */}
        {hasBridge && (
          <section className="cb-block">
            <div className="c-wrap">
              <div className="cb-sechead">
                <div className="cb-sec-eyebrow">The sale / lease pairing</div>
                <h2 className="cb-sec-h2">This building lives in two markets.</h2>
                <p className="cb-sec-lead">The same units that sell here also rent — and the gap between the two is the whole investment case.</p>
              </div>

              <div className="cb-bridge">
                {/* SALE side */}
                <div className={`cb-side cb-sale${a.gyield.saleMedian == null ? " cb-silent" : ""}`}>
                  <span className="cb-side-eyebrow">To buy</span>
                  {a.gyield.saleMedian != null ? (
                    <>
                      <div className="cb-side-num">{money(a.gyield.saleMedian)}</div>
                      <div className="cb-side-meta">{a.records.sale12mo} sold · past 12 months</div>
                      <div className="cb-side-read cb-swap">{buyer ? "Your buy-in — the typical price a unit closes at." : "Your comparables — what recent sellers actually got."}</div>
                    </>
                  ) : (
                    <>
                      <div className="cb-side-num">not shown</div>
                      <div className="cb-side-meta">{a.records.sale12mo} sold · under 5, so no typical price</div>
                      <div className="cb-side-read">Too few recent sales to publish a typical price — we won&rsquo;t guess one.</div>
                    </>
                  )}
                </div>

                {/* YIELD medallion */}
                <div className="cb-mid">
                  <div className="cb-mid-label">Gross yield</div>
                  <div className="cb-mid-num">{a.gyield.headlinePct != null ? `${a.gyield.headlinePct}%` : "—"}</div>
                  <div className="cb-mid-sub">{a.gyield.headlinePct != null ? "annual rent ÷ price" : "needs 5+ sales & 5+ leases"}</div>
                </div>

                {/* LEASE side */}
                <div className={`cb-side cb-lease${a.gyield.leaseMedian == null ? " cb-silent" : ""}`}>
                  <span className="cb-side-eyebrow">To rent</span>
                  {a.gyield.leaseMedian != null ? (
                    <>
                      <div className="cb-side-num">{rent(a.gyield.leaseMedian)}<span className="cb-permo">/mo</span></div>
                      <div className="cb-side-meta">{a.records.lease12mo} leased · past 12 months</div>
                      <div className="cb-side-read cb-swap">{buyer ? "The rent your unit would earn as an investment." : "Proof the unit rents fast — demand under your price."}</div>
                    </>
                  ) : (
                    <>
                      <div className="cb-side-num">not shown</div>
                      <div className="cb-side-meta">{a.records.lease12mo} leased · under 5, so no typical rent</div>
                      <div className="cb-side-read">Not enough recent leases to publish a typical rent.</div>
                    </>
                  )}
                </div>
              </div>

              <p className="cb-bridge-read cb-swap">
                {a.gyield.headlinePct != null ? (
                  buyer
                    ? <>Two markets, one building. You can <Word>live in it</Word> or <Word>rent it out</Word> — at roughly {a.gyield.headlinePct}% gross, the numbers work either way, which is exactly why these units hold their value.</>
                    : <>Your unit is bid on by <Word>two pools at once</Word> — end-users and investors. At roughly {a.gyield.headlinePct}% gross yield, that second pool doesn&rsquo;t exist for most listings; here it competes for yours and supports your price.</>
                ) : !a.kFloors.saleTypical && a.kFloors.leaseTypical ? (
                  buyer
                    ? <>The sale market is thin, but the rental market is <Word>alive</Word> — {a.records.lease12mo} leases in a year. As an owner you&rsquo;d rarely be without a tenant; as a buyer you&rsquo;re entering a building people actively want to live in.</>
                    : <>Sales are infrequent, so pricing leans on the <Word>rental story</Word> — {a.records.lease12mo} leases in twelve months says the demand is here, even when few owners choose to sell.</>
                ) : (
                  <>Both sides of this building&rsquo;s market are still thin — we show only what the record can honestly support, and lean on the neighbourhood below.</>
                )}
              </p>
            </div>
          </section>
        )}

        {/* ---------------- MARKET ACTIVITY ---------------- */}
        {a.records.total > 1 && (
          <section className="cb-block cb-alt">
            <div className="c-wrap">
              <div className="cb-sechead">
                <div className="cb-sec-eyebrow">Market activity</div>
                <h2 className="cb-sec-h2">{buyer ? "How easily you can get in — and out." : "How much recent evidence backs your price."}</h2>
              </div>
              <div className="cb-tiles">
                <div className="cb-tile">
                  <div className="cb-tile-n">{a.records.sale12mo}</div>
                  <div className="cb-tile-l">Sold · past 12 mo</div>
                  <div className="cb-tile-read cb-swap">{buyer ? "Units come up regularly — you won't wait forever." : "Recent, comparable closings to anchor your list price."}</div>
                </div>
                <div className="cb-tile">
                  <div className="cb-tile-n">{a.records.lease12mo}</div>
                  <div className="cb-tile-l">Leased · past 12 mo</div>
                  <div className="cb-tile-read cb-swap">{buyer ? "A deep rental market underneath the sale market." : "Rental demand that widens your buyer pool to investors."}</div>
                </div>
                <div className="cb-tile">
                  <div className="cb-tile-n">{a.records.saleAll + a.records.leaseAll}</div>
                  <div className="cb-tile-l">Trades on record</div>
                  <div className="cb-tile-read">Every number here is drawn from these — no estimates.</div>
                </div>
                <div className="cb-tile">
                  <div className={`cb-tile-n${a.kFloors.saleRange ? "" : " cb-silent-n"}`}>{a.kFloors.saleRange ? "Full" : a.kFloors.saleTypical ? "Typical" : "Thin"}</div>
                  <div className="cb-tile-l">Price confidence</div>
                  <div className="cb-tile-read">{a.kFloors.saleRange ? "10+ sales — enough for a typical price and a full range." : a.kFloors.saleTypical ? "5+ sales — enough for a typical price; a full range needs 10+." : "Under 5 sales — we show the area instead of guessing."}</div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ---------------- PER-BED YIELD ---------------- */}
        {a.gyield.perBed.some((p) => p.yieldPct != null) && (
          <section className="cb-block">
            <div className="c-wrap">
              <div className="cb-sechead">
                <div className="cb-sec-eyebrow">By unit type</div>
                <h2 className="cb-sec-h2">{buyer ? "Which unit is the better investment." : "Which unit type has the strongest rental case."}</h2>
                <p className="cb-sec-lead">Shown only where both a sale and a lease comp clear five recent trades — otherwise we leave it blank.</p>
              </div>
              <div className="cb-beds">
                {a.gyield.perBed.map((p) => (
                  <div className="cb-bedcard" key={p.beds}>
                    <div className="cb-bed-h">{p.beds === 0 ? "Studio" : `${p.beds}-bed`}</div>
                    <div className={`cb-bed-y${p.yieldPct == null ? " cb-dash" : ""}`}>{p.yieldPct == null ? "—" : `${p.yieldPct}%`}</div>
                    <div className="cb-bed-meta">
                      {p.saleMedian != null ? `buy ${money(p.saleMedian)}` : `${p.saleN} sale${p.saleN === 1 ? "" : "s"}`}<br />
                      {p.leaseMedian != null ? `rent ${rent(p.leaseMedian)}/mo` : `${p.leaseN} lease${p.leaseN === 1 ? "" : "s"}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ---------------- AMENITIES ---------------- */}
        {a.amenities.rendered.length > 0 && (
          <section className="cb-block cb-alt">
            <div className="c-wrap">
              <div className="cb-sechead">
                <div className="cb-sec-eyebrow">Inside the building</div>
                <h2 className="cb-sec-h2">Amenities, as recorded on {a.amenities.recordsWithAny} MLS sales.</h2>
                <p className="cb-sec-lead">Only what shows up on two or more of this building&rsquo;s own listings — not a brochure.</p>
              </div>
              <div className="cb-chips">
                {a.amenities.rendered.map((am) => <span className="cb-chip" key={am}>{am}</span>)}
              </div>
              <div className="cb-aside cb-swap">
                {buyer
                  ? <>What you&rsquo;re actually paying maintenance for. <b>Confirm the current list with management</b> before you close.</>
                  : <>The features to <b>lead your listing with</b> — buyers see these on every comparable sale, so make yours stand out.</>}
              </div>
            </div>
          </section>
        )}

        {/* ---------------- FEES & MANAGEMENT ---------------- */}
        {(a.records.total > 1) && (
          <section className="cb-block">
            <div className="c-wrap">
              <div className="cb-sechead">
                <div className="cb-sec-eyebrow">Running the building</div>
                <h2 className="cb-sec-h2">Fees &amp; management.</h2>
              </div>
              <div className="cb-two">
                <div className="cb-panel">
                  <div className="cb-panel-h">Maintenance fee includes</div>
                  {a.feeIncludes.stated ? (
                    <div className="cb-chips">{a.feeIncludes.items.map((it) => <span className="cb-chip" key={it}>{it.replace(/ Included$/i, "")}</span>)}</div>
                  ) : (
                    <div className="cb-panel-v cb-silent-v">Not stated — confirm with management</div>
                  )}
                  {!a.feeIncludes.stated && <div className="cb-panel-note">Fewer than three of this building&rsquo;s sales spelled out the fee inclusions, so we won&rsquo;t assert a list.</div>}
                </div>
                <div className="cb-panel">
                  <div className="cb-panel-h">Property management</div>
                  {a.management.company ? (
                    <div className="cb-panel-v">{a.management.company}</div>
                  ) : (
                    <div className="cb-panel-v cb-silent-v">Not on record</div>
                  )}
                  <div className="cb-panel-note">{a.management.company ? "The company named on the building's most recent sales." : "No management company appears on this building's recent sales."}</div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ---------------- AREA CONTEXT ---------------- */}
        <section className={`cb-block${a.records.total > 1 ? " cb-alt" : ""}`}>
          <div className="c-wrap">
            <div className={`cb-area${a.kFloors.identityOnly ? " cb-identity" : ""}`}>
              <div className="cb-area-eyebrow">{a.kFloors.identityOnly || !a.kFloors.saleTypical ? "Where this building sits" : "The wider market"}</div>
              {a.areaContext.typicalCondo != null ? (
                <>
                  <div className="cb-area-n">{money(a.areaContext.typicalCondo)}</div>
                  <p className="cb-area-t">
                    {a.kFloors.identityOnly || !a.kFloors.saleTypical
                      ? <>is what condos across <strong>{nbhd}</strong> typically sell for. Until this building has enough of its own recent sales, that&rsquo;s the honest anchor for {buyer ? "what you&rsquo;d pay" : "what to expect"}.</>
                      : <>is the typical condo price across <strong>{nbhd}</strong> — the backdrop your building trades against.</>}
                  </p>
                </>
              ) : (
                <p className="cb-area-t">Neighbourhood condo pricing for {nbhd} isn&rsquo;t available yet — this building will fill in as the record grows.</p>
              )}
            </div>
          </div>
        </section>

        {/* ---------------- METHOD ---------------- */}
        <section className="cb-block">
          <div className="c-wrap">
            <p className="cb-method">
              <b>How we built this page.</b> Every figure comes from {name}&rsquo;s own recorded sales and leases — nothing is estimated or scraped from a brochure. &ldquo;Typical&rdquo; means the median of five or more comparable trades; below that we say so rather than show a shaky number, and we never display an individual unit&rsquo;s price. A full price range needs ten or more sales. Where a building&rsquo;s own record is thin, the {config.CITY_NAME} neighbourhood context carries the page.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
