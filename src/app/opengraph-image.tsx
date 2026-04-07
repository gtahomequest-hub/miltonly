import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Miltonly — Milton Ontario real estate platform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0A1628 0%, #152D52 50%, #0A1628 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px",
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: "white",
            letterSpacing: "-1px",
            marginBottom: "16px",
          }}
        >
          miltonly
        </div>
        <div
          style={{
            fontSize: 28,
            color: "rgba(255,255,255,0.5)",
            textAlign: "center",
            maxWidth: "700px",
            lineHeight: 1.4,
          }}
        >
          Milton Ontario Real Estate — Homes For Sale, Street Data &amp; Market Intelligence
        </div>
        <div
          style={{
            display: "flex",
            gap: "24px",
            marginTop: "40px",
          }}
        >
          {["Street Intelligence", "School Zones", "GO Commute", "Live TREB Data"].map(
            (tag) => (
              <div
                key={tag}
                style={{
                  background: "rgba(37,99,235,0.2)",
                  border: "1px solid rgba(37,99,235,0.3)",
                  color: "rgba(147,197,253,1)",
                  fontSize: 14,
                  fontWeight: 600,
                  padding: "8px 16px",
                  borderRadius: "8px",
                }}
              >
                {tag}
              </div>
            )
          )}
        </div>
        <div
          style={{
            position: "absolute",
            bottom: "40px",
            fontSize: 16,
            color: "rgba(255,255,255,0.3)",
          }}
        >
          miltonly.com
        </div>
      </div>
    ),
    { ...size }
  );
}
