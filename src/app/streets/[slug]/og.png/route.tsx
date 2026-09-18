// THE RENDERED PRICE CARD (MH-005, MA-001 change 6). A shared street link had no image at all.
// Where the street is filmed the head points at the poster; everywhere else it points here: the
// street's name, its typical price with the sample and window that price was derived from, or,
// below the floor, the strongest fact the page can publish. Forest ground, the CTA green on the
// figure, the site's name in the corner.
//
// AT THE EDGE, FED BY /api/streets/<slug>/card. next/og's renderer runs at the edge; the data
// needs Node (Prisma, the Neon driver), so the facts come from the Node route on the same
// deployment and this file imports nothing of the app's. Rendered once a day per street.
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const revalidate = 86400;

const W = 1200;
const H = 630;

interface Card {
  name: string;
  area: string;
  city: string;
  province: string;
  figure: string | null;
  basis: string;
}

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const api = new URL(`/api/streets/${encodeURIComponent(params.slug)}/card`, req.url);
  const r = await fetch(api, { next: { revalidate: 86400 } });
  if (r.status !== 200) return new Response("Not found", { status: 404 });
  const card = (await r.json()) as Card;

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
            {`Street profile · ${card.area}`}
          </div>
          <div style={{ fontSize: 84, lineHeight: 1.02, marginTop: 18, letterSpacing: -2 }}>{card.name}</div>
          <div style={{ fontSize: 30, marginTop: 12, color: "rgba(255,255,255,0.78)", fontFamily: "sans-serif" }}>
            {`${card.city}, ${card.province}`}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {card.figure ? <div style={{ fontSize: 96, color: "#00ff80", lineHeight: 1 }}>{card.figure}</div> : null}
            <div style={{ fontSize: 26, marginTop: 14, color: "rgba(255,255,255,0.8)", fontFamily: "sans-serif" }}>{card.basis}</div>
          </div>
          <div style={{ fontSize: 34, color: "#ffc400", fontFamily: "sans-serif" }}>miltonly.com</div>
        </div>
      </div>
    ),
    { width: W, height: H, headers: { "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
  );
}
