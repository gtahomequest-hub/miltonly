// src/app/blog/page.tsx
// Honest noindex placeholder. /blog has no posts, no MDX, no generator, no DB,
// and is absent from the sitemap — so it is marked noindex (Google won't index
// an empty page) while staying a valid 200 (nothing dead-ends here). The dead
// email-stub input (no POST) is removed — no fake signup. Minimal forest shell
// (SiteNav + FooterSection) so a direct visitor isn't stranded on a navy box;
// this is deliberately NOT a forest directory build (there is nothing to render).
import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import SiteNav from "@/components/nav/SiteNav";
import FooterSection from "@/components/sections/FooterSection";

export const metadata = {
  ...genMeta({
    title: `${config.CITY_NAME} Real Estate Insights — Coming Soon`,
    description: `Market updates, neighbourhood guides and buying tips for ${config.CITY_NAME} ${config.CITY_PROVINCE} real estate — coming soon.`,
    canonical: `${config.SITE_URL}/blog`,
  }),
  // Empty page — keep it out of the index, but let crawlers follow the nav/footer
  // links back into the real site.
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

export default function BlogPage() {
  return (
    <div style={{ background: "#fffdfa", minHeight: "100vh", color: "#292b29" }}>
      <SiteNav variant="page" />
      <section
        style={{
          paddingTop: 66,
          background: "#073126",
          color: "#fff",
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 480, padding: "48px 24px" }}>
          <p
            style={{
              fontSize: 11,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "#00ff80",
              fontWeight: 600,
              marginBottom: 14,
            }}
          >
            {config.CITY_NAME} insights
          </p>
          <h1
            style={{
              fontFamily: "var(--font-fraunces), Georgia, serif",
              fontWeight: 400,
              fontSize: "clamp(28px, 4vw, 40px)",
              lineHeight: 1.1,
              margin: "0 0 14px",
            }}
          >
            Market notes are <em style={{ color: "#00ff80", fontStyle: "italic" }}>on the way</em>
          </h1>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.8)", lineHeight: 1.6 }}>
            Market updates, neighbourhood guides, and buying tips for {config.CITY_NAME}{" "}
            {config.CITY_PROVINCE} are in the works. In the meantime, the live data is already on
            the site — browse {config.CITY_NAME} listings, streets, and neighbourhoods from the
            menu above.
          </p>
        </div>
      </section>
      <FooterSection />
    </div>
  );
}
