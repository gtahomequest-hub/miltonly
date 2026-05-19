import type {
  GoogleReviewsSnapshot,
  PressLogo,
  Testimonial,
} from "./_types";

interface ProofSectionProps {
  testimonials: Testimonial[];
  googleReviews: GoogleReviewsSnapshot;
  pressLogos: PressLogo[];
}

/**
 * Social proof block — Google rating + count, 5 testimonial cards,
 * press/awards logo strip.
 *
 * SCAFFOLD: Mobile horizontal-scroll carousel and review_card_visible
 * IntersectionObserver are split into a client subcomponent in Gate 4.
 * This server shell renders the data so the page composes cleanly today.
 * Google Places API integration deferred — googleReviews values come
 * from config.realtor.metrics until that wiring lands (D5).
 */
export default function ProofSection(props: ProofSectionProps) {
  const ratingReady =
    props.googleReviews.score !== null && props.googleReviews.count !== null;

  return (
    <section
      data-section="about-proof"
      aria-labelledby="about-proof-heading"
    >
      <h2 id="about-proof-heading">Proof and reviews</h2>

      <div data-role="google-rating">
        {ratingReady ? (
          <>
            <strong data-role="score">{props.googleReviews.score}</strong>
            <span data-role="count">
              {props.googleReviews.count} Google reviews
            </span>
          </>
        ) : (
          <span data-role="placeholder">Google reviews coming shortly</span>
        )}
      </div>

      <ol data-role="testimonials" data-count={props.testimonials.length}>
        {props.testimonials.length === 0 ? (
          <li data-role="placeholder">Testimonials coming shortly.</li>
        ) : (
          props.testimonials.map((t, i) => (
            <li key={`${t.customerName}-${i}`} data-testimonial>
              <div data-role="rating" data-stars={t.rating} />
              <blockquote>{t.quote}</blockquote>
              <cite>{t.customerName}</cite>
              <p data-role="outcome">{t.outcome}</p>
              <time>{t.date}</time>
            </li>
          ))
        )}
      </ol>

      <ul data-role="press-logos" data-count={props.pressLogos.length}>
        {props.pressLogos.map((logo) => (
          <li key={logo.alt}>
            {logo.href ? (
              <a href={logo.href} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logo.src} alt={logo.alt} loading="lazy" />
              </a>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo.src} alt={logo.alt} loading="lazy" />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
