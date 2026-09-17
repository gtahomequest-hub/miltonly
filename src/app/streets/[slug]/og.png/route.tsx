// THE RENDERED PRICE CARD (MH-005, MA-001 change 6). A shared street link had no image at all.
// Where the street is filmed the head points at the poster; everywhere else it points here: the
// street's name, its typical price with the sample and window that price was derived from
// (the same basis object the description states, so the card and the snippet cannot disagree),
// or, below the floor, the strongest fact the page can publish. Forest ground, the CTA green on
// the figure, the site's name in the corner. Rendered once a day per street at the edge.
import { ImageResponse } from "next/og";
import { config } from "@/lib/config";
import { getStreetPageData } from "@/lib/street-data";
import { roundPriceForProse } from "@/lib/format";
import { formatCAD } from "@/lib/charts/theme";
import { windowDisclosure } from "@/lib/streetEnrichment";

export const revalidate = 86400;

const W = 1200;
const H = 630;

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const data = await getStreetPageData(params.slug);
  if (!data) return new Response("Not found", { status: 404 });

  const sb = data.enrichment?.saleBasis ?? null;
  const sales = data.enrichment?.counts.sale12mo ?? 0;
  const leases = data.enrichment?.counts.lease12mo ?? 0;
  const figure = sb ? formatCAD(roundPriceForProse(sb.typical)) : null;
  const basis = sb
    ? `typical sale price, ${windowDisclosure(sb)}`
    : sales > 0
      ? `${sales} sale${sales === 1 ? "" : "s"} on record in the last 12 months`
      : leases > 0
        ? `${leases} lease${leases === 1 ? "" : "s"} on record in the last 12 months`
        : "current listings and the full street read";
  const area = data.street.neighbourhoods?.[0] ?? config.CITY_NAME;

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "linear-gradient(135deg, #073126 0%, #0a3d30 100%)",
          color: "#ffffff",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 24, letterSpacing: 4, color: "#5cffa8", textTransform: "uppercase", fontFamily: "monospace" }}>
            Street profile · {area}
          </div>
          <div style={{ fontSize: 84, lineHeight: 1.02, marginTop: 18, letterSpacing: -2 }}>{data.street.name}</div>
          <div style={{ fontSize: 30, marginTop: 12, color: "rgba(255,255,255,0.78)", fontFamily: "sans-serif" }}>
            {config.CITY_NAME}, {config.CITY_PROVINCE}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {figure ? (
              <div style={{ display: "flex", alignItems: "baseline" }}>
                <span style={{ fontSize: 96, color: "#00ff80", lineHeight: 1 }}>{figure}</span>
              </div>
            ) : null}
            <div style={{ fontSize: 26, marginTop: 14, color: "rgba(255,255,255,0.8)", fontFamily: "sans-serif" }}>{basis}</div>
          </div>
          <div style={{ fontSize: 34, color: "#ffc400", fontFamily: "sans-serif" }}>miltonly.com</div>
        </div>
      </div>
    ),
    { width: W, height: H },
  );
}
