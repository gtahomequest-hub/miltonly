import Link from "next/link";
import { Container, SerifHeading, Eyebrow, Body } from "@/components/ui";
import type { ActiveInventoryProps } from "@/types/street";
import { formatCADShort } from "@/lib/charts/theme";

export function ActiveInventory({ listings, streetName, streetShort }: ActiveInventoryProps) {
  const hasListings = listings.length > 0;

  return (
    <section id="s8" className="border-b" style={{ paddingTop: 96, paddingBottom: 96, borderColor: "var(--line)" }}>
      <Container>
        <Eyebrow color="blue" size="lg" className="block mb-3">Active inventory</Eyebrow>
        <SerifHeading level={2}>
          {hasListings ? (
            <>
              <em>{listings.length}</em> {listings.length === 1 ? "home" : "homes"} currently for sale
            </>
          ) : (
            <>
              Nothing <em>live</em> right now
            </>
          )}
        </SerifHeading>
        <Body variant="lead" className="mt-4 max-w-3xl">
          {hasListings
            ? `All current listings on ${streetName}. Click through for the full listing detail and photos.`
            : `No active listings on ${streetName} at the moment. Most weeks something does surface, and we can hold a spot on the alert list.`}
        </Body>

        {hasListings ? (
          <div className="active-listings-grid">
            {listings.map((l) => (
              <Link key={l.mlsNumber} href={l.href} className="active-card">
                <div className="active-card-photo" style={l.photo ? { backgroundImage: `url(${l.photo})` } : undefined} aria-hidden />
                <div className="active-card-price">{formatCADShort(l.price)}</div>
                <div className="active-card-address">{l.address}</div>
                <div className="active-card-specs">
                  {l.bedrooms}bd · {l.bathrooms}ba · {l.parking}pk · {l.propertyType}{l.daysOnMarket !== null ? ` · ${l.daysOnMarket}d` : ""}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-listings">
            <h4>Get notified when a home hits {streetShort}</h4>
            <p>We send an email the same day a listing goes live. No newsletter, no re-marketing.</p>
            <form className="alert-form" action="/api/alerts/subscribe" method="POST">
              <input type="email" name="email" placeholder="your@email.com" aria-label="Email address" required />
              <input type="hidden" name="street" value={streetShort} />
              <button type="submit">Alert me</button>
            </form>
          </div>
        )}
      </Container>
    </section>
  );
}

