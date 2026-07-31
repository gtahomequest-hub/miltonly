"use client";
// Build B (revision) — the /condos/[slug] page. Renders a SANITIZED, server-computed CondoView
// (never the raw Build A payload — the props are serialized into the HTML, so only display-safe
// values cross this boundary: k-gated medians, proportions, banded velocity, resolved strings).
// Hero LEADS WITH THE RELATIONSHIP (buy · rent = yield). The Buyer<->Seller lens changes the
// CONVERSATION, not just captions. No per-unit prices, no raw transaction counts anywhere.
import { useState } from "react";
import "./condo-theme.css";
import "./condo-b.css";
import type { CondoView } from "@/lib/ai/condoView";
import { SiteNav } from "../nav/SiteNav";
import { config } from "@/lib/config";
import { formatPrice } from "@/lib/format";

type Lens = "buyer" | "seller";
const money = (n: number | null) => (n == null ? "—" : formatPrice(n));
const rent = (n: number | null) => (n == null ? "—" : `$${Math.round(n).toLocaleString("en-CA")}`);
const Word = ({ children }: { children: React.ReactNode }) => <em className="cb-lensword">{children}</em>;

function positioning(v: CondoView): string {
  if (v.identityOnly) return "New to the record — too few recent trades in this building to show its own numbers yet, so here's what the surrounding market says.";
  if (!v.saleTypical && v.leaseTypical) return "A rental-forward building — it changes hands quietly, but it rarely sits empty.";
  if (v.yieldPct != null) return "A dual-market building — owner-occupiers and investors compete for the same units here.";
  if (v.saleTypical) return "Priced with confidence — enough recent sales to know the typical number.";
  return "A Milton condo building, told entirely through its own recorded sales and leases.";
}

export default function BuildingAttributesPage({ view }: { view: CondoView }) {
  const [lens, setLens] = useState<Lens>("buyer");
  const v = view;
  const buyer = lens === "buyer";
  const { name, neighbourhood: nbhd, buy, rent: rnt, yieldPct: yld, area } = v;
  const act = v.activity;

  return (
    <div className="condo-v2">
      <SiteNav variant="page" />
      <div className="cb">
        {/* ---------------- HERO: lead with the RELATIONSHIP ---------------- */}
        <header className="cb-hero">
          <div className="c-wrap">
            <nav className="cb-crumb">
              <a href={config.SITE_URL}>Home</a> &nbsp;/&nbsp; <a href="/condos">Condos</a> &nbsp;/&nbsp; {name}
            </nav>
            <div className="cb-eyebrow">{config.CITY_NAME} condo building</div>
            <h1 className="cb-title">{name}</h1>
            <p className="cb-sub">{positioning(v)}</p>

            <div className="cb-lens" data-lens={lens} role="group" aria-label="Read this building as a buyer or a seller">
              <span className="cb-lens-thumb" aria-hidden />
              <button type="button" className="cb-lens-btn" aria-pressed={buyer} onClick={() => setLens("buyer")}>I&rsquo;m buying</button>
              <button type="button" className="cb-lens-btn" aria-pressed={!buyer} onClick={() => setLens("seller")}>I&rsquo;m selling</button>
            </div>

            <div className="cb-relation">
              <div className="cb-rel-item">
                {buy != null ? <span className="cb-rel-num">{money(buy)}</span> : <span className="cb-rel-num cb-quiet">quiet sale market</span>}
                <span className="cb-rel-label">{buyer ? "you'd buy for" : "worth to an owner"}</span>
              </div>
              <span className="cb-rel-op">·</span>
              <div className="cb-rel-item">
                {rnt != null ? <span className="cb-rel-num">{rent(rnt)}<span className="cb-permo">/mo</span></span> : <span className="cb-rel-num cb-quiet">{area != null ? money(area) : "—"}</span>}
                <span className="cb-rel-label">{rnt != null ? "it rents for" : `${nbhd} typical`}</span>
              </div>
              {yld != null && (
                <>
                  <span className="cb-rel-op">=</span>
                  <div className="cb-rel-item"><span className="cb-rel-num cb-yield">{yld}%</span><span className="cb-rel-label">gross yield</span></div>
                </>
              )}
            </div>

            <p className="cb-rel-read cb-swap">
              {yld != null ? (
                buyer
                  ? <>That <Word>{yld}% yield</Word> is the catch: it&rsquo;s high enough that investors want these units too — so as a buyer here, you&rsquo;re competing with landlords, not just other families.</>
                  : <>Two buyers want your unit at once: an owner to <Word>live in it</Word>, an investor for that <Word>{yld}% return</Word>. That second pool doesn&rsquo;t exist for most listings — here it bids up yours.</>
              ) : !v.saleTypical && rnt != null ? (
                buyer
                  ? <>Sales are rare, so there&rsquo;s no crowd of competing buyers — but it&rsquo;s a <Word>proven rental</Word> building, which is the whole case if you&rsquo;re here to invest.</>
                  : <>Owners rarely sell here, so a listing stands out — and the <Word>rental demand</Word> underneath means investor buyers are already watching this address.</>
              ) : (
                buyer
                  ? <>Until this building trades more, the <Word>{nbhd} market</Word> is your best guide to what you&rsquo;d pay.</>
                  : <>Too few of its own trades to price it yet — the <Word>{nbhd} market</Word> is what a buyer will compare against.</>
              )}
            </p>
          </div>
        </header>

        {/* ---------------- GENERATED NARRATIVE (grounded, fail-closed) ---------------- */}
        {v.narrative && (
          <section className="cb-block cb-narr-wrap">
            <div className="c-wrap">
              <div className="cb-narr-tag">The building, in brief</div>
              <p className="cb-narr">{v.narrative}</p>
            </div>
          </section>
        )}

        {/* ---------------- HOW THE BUILDING IS MADE UP (aggregate viz) ---------------- */}
        {(act.mode !== "none" || yld != null || v.saleTypical || v.leaseTypical) && (
          <section className="cb-block">
            <div className="c-wrap">
              <div className="cb-sechead">
                <div className="cb-sec-eyebrow">Its market · past 12 months</div>
                <h2 className="cb-sec-h2">{buyer ? "How active it is." : "How much moves here."}</h2>
                <p className="cb-sec-lead">Recorded sale and lease activity — labelled as activity, never occupancy, and never a count small enough to point at one unit.</p>
              </div>

              {act.mode === "split" && (
                <div className="cb-mix">
                  <div className="cb-mix-bar">
                    <div className="cb-mix-seg cb-mix-owner" style={{ width: `${act.salesPct}%` }}>{act.salesPct}%</div>
                    <div className="cb-mix-seg cb-mix-rent" style={{ width: `${act.leasesPct}%` }}>{act.leasesPct}%</div>
                  </div>
                  <div className="cb-mix-legend">
                    <span><span className="cb-mix-dot" style={{ background: "#017848" }} />Resale activity · ~{act.salesApprox} sales</span>
                    <span><span className="cb-mix-dot" style={{ background: "#0d3a2b" }} />Rental activity · ~{act.leasesApprox} leases</span>
                  </div>
                  <p className="cb-verdict cb-swap">
                    {act.leasesPct >= 55
                      ? (buyer ? <>Leasing is the busier market — investors are <Word>active in this building</Word>, so you&rsquo;ll compete with them, and your unit would let easily.</> : <>An active rental market means <Word>investor buyers</Word> are watching — a second pool alongside owner-occupiers.</>)
                      : (buyer ? <>Resale is the busier market — a <Word>live-in building</Word> where units turn over to owners.</> : <>Owners drive this market — sell to <Word>end-users</Word> who want a home, not a spreadsheet.</>)}
                  </p>
                </div>
              )}
              {act.mode === "qual" && (
                <div className="cb-mix">
                  <p className="cb-mix-qual">{act.leaseHeavy ? <>Recent activity is <b>overwhelmingly leasing</b> — resales are rare here.</> : <>Recent activity is <b>mostly resale</b> — it seldom trades as a rental.</>}</p>
                  <p className="cb-verdict cb-swap">{act.leaseHeavy ? (buyer ? <>A <Word>rental-active</Word> building — strong for income, quieter to resell.</> : <>Your natural buyer is an <Word>investor</Word>; the rental track record is your pitch.</>) : (buyer ? <>A <Word>live-in</Word> building — neighbours are owners, not tenants.</> : <>End-user demand leads — sell the <Word>home</Word>, not the yield.</>)}</p>
                </div>
              )}

              {yld != null && buy != null && rnt != null && (
                <div className="cb-mix" style={{ marginTop: 34, maxWidth: 720 }}>
                  <div className="cb-flow">
                    <div><div className="cb-flow-n">{money(buy)}</div><div className="cb-flow-l">typical buy</div></div>
                    <span className="cb-flow-op">→</span>
                    <div><div className="cb-flow-n">${(Math.round(rnt) * 12).toLocaleString("en-CA")}</div><div className="cb-flow-l">rent / year</div></div>
                    <span className="cb-flow-op">=</span>
                    <div><div className="cb-flow-n cb-yield">{yld}%</div><div className="cb-flow-l">gross return</div></div>
                  </div>
                </div>
              )}

              <div className="cb-velo" style={{ marginTop: 34 }}>
                <div className="cb-velo-item">
                  <div className="cb-velo-band">{v.saleTypical ? `${v.saleVelo} resold` : "Rarely resold"}</div>
                  <div className="cb-velo-l">{buyer ? "how often a unit comes up" : "how much resale evidence you have"}</div>
                </div>
                <div className="cb-velo-item">
                  <div className="cb-velo-band">{v.leaseVelo} leased</div>
                  <div className="cb-velo-l">{buyer ? "rental turnover" : "rental demand behind your price"}</div>
                </div>
                {v.totalTradesLabel != null && (
                  <div className="cb-velo-item">
                    <div className="cb-velo-band">{v.totalTradesLabel} on record</div>
                    <div className="cb-velo-l">trades every number is drawn from</div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ---------------- THE TWO MARKETS BRIDGE ---------------- */}
        {v.hasBridge && (
          <section className="cb-block cb-alt">
            <div className="c-wrap">
              <div className="cb-sechead">
                <div className="cb-sec-eyebrow">The sale / lease pairing</div>
                <h2 className="cb-sec-h2">This building lives in two markets.</h2>
              </div>
              <div className="cb-bridge">
                <div className={`cb-side cb-sale${buy == null ? " cb-silent" : ""}`}>
                  <span className="cb-side-eyebrow">To buy</span>
                  {buy != null ? (
                    <><div className="cb-side-num">{money(buy)}</div><div className="cb-side-meta">{v.saleVelo.toLowerCase()} resold · past year</div><div className="cb-side-read cb-swap">{buyer ? "Your buy-in — the typical closing price." : "Your comparables — what recent sellers got."}</div></>
                  ) : (
                    <><div className="cb-side-num">not shown</div><div className="cb-side-meta">too few recent sales for a typical price</div><div className="cb-side-read">We won&rsquo;t publish a price the record can&rsquo;t support.</div></>
                  )}
                </div>
                <div className="cb-mid">
                  <div className="cb-mid-label">Gross yield</div>
                  <div className="cb-mid-num">{yld != null ? `${yld}%` : "—"}</div>
                  <div className="cb-mid-sub">{yld != null ? "annual rent ÷ price" : "needs both sides"}</div>
                </div>
                <div className={`cb-side cb-lease${rnt == null ? " cb-silent" : ""}`}>
                  <span className="cb-side-eyebrow">To rent</span>
                  {rnt != null ? (
                    <><div className="cb-side-num">{rent(rnt)}<span className="cb-permo">/mo</span></div><div className="cb-side-meta">{v.leaseVelo.toLowerCase()} leased · past year</div><div className="cb-side-read cb-swap">{buyer ? "Rent it earns as an investment." : "Proof the unit rents — demand under your price."}</div></>
                  ) : (
                    <><div className="cb-side-num">not shown</div><div className="cb-side-meta">too few recent leases for a typical rent</div><div className="cb-side-read">Not enough recent leases to publish a rent.</div></>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ---------------- LENS-EXCLUSIVE: BUYER (priced against nbhd) ---------------- */}
        {buyer && area != null && (
          <section className="cb-block">
            <div className="c-wrap">
              <div className="cb-sechead"><div className="cb-sec-eyebrow">What it costs you</div><h2 className="cb-sec-h2">How it prices against {nbhd}.</h2></div>
              {buy != null ? (
                <div className="cb-cmp">
                  <div className="cb-cmp-row">
                    <span className="cb-cmp-k">This building</span>
                    <span className="cb-cmp-track"><span className="cb-cmp-fill cb-bld" style={{ width: `${Math.min(100, Math.round((buy / Math.max(buy, area)) * 100))}%` }} /></span>
                    <span className="cb-cmp-v">{money(buy)}</span>
                  </div>
                  <div className="cb-cmp-row">
                    <span className="cb-cmp-k">{nbhd} typical</span>
                    <span className="cb-cmp-track"><span className="cb-cmp-fill cb-area" style={{ width: `${Math.min(100, Math.round((area / Math.max(buy, area)) * 100))}%` }} /></span>
                    <span className="cb-cmp-v">{money(area)}</span>
                  </div>
                  <p className="cb-verdict">{buy > area * 1.06 ? <>You pay a <Word>premium</Word> over the {nbhd} typical — worth it only if this building&rsquo;s amenities and yield justify it.</> : buy < area * 0.94 ? <>A <Word>value entry</Word> — priced below the {nbhd} typical.</> : <>Priced <Word>right in line</Word> with the {nbhd} market — no premium to argue over.</>}</p>
                </div>
              ) : (
                <p className="cb-sec-lead">Sales here are too quiet to price the building itself — the {nbhd} typical of <strong>{money(area)}</strong> is the honest anchor for what you&rsquo;d pay.</p>
              )}
            </div>
          </section>
        )}

        {/* ---------------- LENS-EXCLUSIVE: SELLER (who's buying) ---------------- */}
        {!buyer && (
          <section className="cb-block">
            <div className="c-wrap">
              <div className="cb-sechead"><div className="cb-sec-eyebrow">Your buyers</div><h2 className="cb-sec-h2">{v.hasTrades ? "Who’s bidding on your unit." : "Who you’d be selling to."}</h2></div>
              <p className="cb-sec-lead">
                {yld != null
                  ? <>Two pools at once. Owner-occupiers who want to live here, and investors chasing the ~{yld}% yield — that second group is why units here don&rsquo;t linger. Price for both and you sell fast.</>
                  : v.hasTrades && act.mode !== "none" && (act.mode === "qual" ? act.leaseHeavy : act.leasesPct >= 55)
                    ? <>Your natural buyer is an <strong>investor</strong> — this is a rental-active building, and the leasing track record is what closes them.</>
                    : v.hasTrades && area != null
                      ? <>Your buyers are mostly <strong>owner-occupiers</strong> — lead with the home and amenities, and price against the {nbhd} typical of {money(area)}.</>
                      : area != null
                        ? <>This building doesn&rsquo;t trade often enough yet to name your buyers — price against the <strong>{nbhd}</strong> typical of {money(area)}, which is what any buyer will compare to.</>
                        : <>There isn&rsquo;t enough of its own record yet to profile your buyers.</>}
              </p>
              {v.hasTrades && (
                <div className="cb-velo" style={{ marginTop: 22 }}>
                  <div className="cb-velo-item"><div className="cb-velo-band">{v.saleTypical ? v.saleVelo : "Rarely"}</div><div className="cb-velo-l">how fast units here resell</div></div>
                  <div className="cb-velo-item"><div className="cb-velo-band">{v.leaseVelo}</div><div className="cb-velo-l">rental demand under your price</div></div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ---------------- PER-BED (medians only, no raw counts) ---------------- */}
        {v.perBed.length > 0 && (
          <section className="cb-block cb-alt">
            <div className="c-wrap">
              <div className="cb-sechead">
                <div className="cb-sec-eyebrow">By unit type</div>
                <h2 className="cb-sec-h2">{buyer ? "Which unit is the better investment." : "Which unit type has the strongest case."}</h2>
                <p className="cb-sec-lead">Shown only where both a sale and a lease clear five recent trades.</p>
              </div>
              <div className="cb-beds">
                {v.perBed.map((p) => (
                  <div className="cb-bedcard" key={p.beds}>
                    <div className="cb-bed-h">{p.beds === 0 ? "Studio" : `${p.beds}-bed`}</div>
                    <div className="cb-bed-y">{p.yieldPct}%</div>
                    <div className="cb-bed-meta">buy {money(p.buy)}<br />rent {rent(p.rent)}/mo</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ---------------- AMENITIES ---------------- */}
        {v.amenities.length > 0 && (
          <section className="cb-block">
            <div className="c-wrap">
              <div className="cb-sechead">
                <div className="cb-sec-eyebrow">Inside the building</div>
                <h2 className="cb-sec-h2">Amenities, from the building&rsquo;s own sold listings.</h2>
                <p className="cb-sec-lead">Only what appears on two or more of this building&rsquo;s sales{v.amenitiesRecords != null ? ` (${v.amenitiesRecords} on record)` : ""} — not a brochure.</p>
              </div>
              <div className="cb-chips">{v.amenities.map((am) => <span className="cb-chip" key={am}>{am}</span>)}</div>
              <div className="cb-aside cb-swap">{buyer ? <>What your maintenance fee actually buys. <b>Confirm the current list with management.</b></> : <>The features to <b>lead your listing with</b> — make yours stand out from the comparables.</>}</div>
            </div>
          </section>
        )}

        {/* ---------------- FEES & MANAGEMENT ---------------- */}
        {v.hasTrades && (
          <section className="cb-block cb-alt">
            <div className="c-wrap">
              <div className="cb-sechead"><div className="cb-sec-eyebrow">Running the building</div><h2 className="cb-sec-h2">Fees &amp; management.</h2></div>
              <div className="cb-two">
                <div className="cb-panel">
                  <div className="cb-panel-h">Maintenance fee includes</div>
                  {v.feeStated ? (
                    <div className="cb-chips">{v.feeItems.map((it) => <span className="cb-chip" key={it}>{it.replace(/ Included$/i, "")}</span>)}</div>
                  ) : (
                    <><div className="cb-panel-v cb-silent-v">Not stated — confirm with management</div><div className="cb-panel-note">Too few of this building&rsquo;s sales spelled out the inclusions to assert a list.</div></>
                  )}
                </div>
                <div className="cb-panel">
                  <div className="cb-panel-h">Property management</div>
                  {v.management ? <div className="cb-panel-v">{v.management}</div> : <div className="cb-panel-v cb-silent-v">Not on record</div>}
                  <div className="cb-panel-note">{v.management ? "Named on the building's most recent sales." : "No management company on the building's recent sales."}</div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ---------------- AREA CONTEXT ---------------- */}
        <section className="cb-block">
          <div className="c-wrap">
            <div className={`cb-area${v.identityOnly ? " cb-identity" : ""}`}>
              <div className="cb-area-eyebrow">{v.identityOnly || !v.saleTypical ? "Where this building sits" : "The wider market"}</div>
              {area != null ? (
                <>
                  <div className="cb-area-n">{money(area)}</div>
                  <p className="cb-area-t">{v.identityOnly || !v.saleTypical ? <>is what condos across <strong>{nbhd}</strong> typically sell for — the honest anchor for {buyer ? "what you&rsquo;d pay" : "what to expect"} until this building trades more.</> : <>is the typical condo price across <strong>{nbhd}</strong>, the backdrop this building trades against.</>}</p>
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
              <b>How we built this page.</b> Every figure comes from {name}&rsquo;s own recorded sales and leases — nothing is estimated, and no listing&rsquo;s description or private remarks are used. &ldquo;Typical&rdquo; means the median of five or more comparable trades; below that we say so rather than show a shaky number, we never display an individual unit&rsquo;s price, and we only ever show whole-building proportions — never a count small enough to point at one owner. The short summary above is assembled sentence-by-sentence from these same aggregate numbers — composed, not written by a model. Where a building&rsquo;s own record is thin, the {config.CITY_NAME} neighbourhood context carries the page.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
