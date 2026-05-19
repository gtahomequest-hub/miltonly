interface BioSectionProps {
  /** Full realtor name for the section heading. */
  name: string;
  /** 200-300 word bio, advisory-boutique voice. Empty string renders
   *  the "coming shortly" placeholder until Aamir delivers item B15. */
  bio: string;
  /** Languages business is conducted in. Renders as an explicit
   *  capability line — "Conducts business in English, Hindi, Urdu,
   *  and Punjabi." */
  languages: readonly string[];
}

/**
 * 200-300 word bio block. Voice rules locked per DEC-ABOUT-CANONICAL:
 * zero em-dashes, zero superlatives, zero AI tells. Specific over
 * vague. Advisor not salesperson.
 *
 * SCAFFOLD: visual implementation deferred to Gate 4. This file ships
 * as a typed contract.
 */
export default function BioSection(props: BioSectionProps) {
  const firstName = props.name.split(" ")[0];

  return (
    <section
      data-section="about-bio"
      aria-labelledby="about-bio-heading"
    >
      <h2 id="about-bio-heading">About {firstName}</h2>

      {props.bio ? (
        <div data-role="bio-body">
          {props.bio.split("\n\n").map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      ) : (
        <p data-role="placeholder">Full bio coming shortly.</p>
      )}

      {props.languages.length > 0 ? (
        <p data-role="languages">
          Conducts business in {formatLanguageList(props.languages)}.
        </p>
      ) : null}
    </section>
  );
}

function formatLanguageList(languages: readonly string[]): string {
  if (languages.length === 0) return "";
  if (languages.length === 1) return languages[0];
  if (languages.length === 2) return `${languages[0]} and ${languages[1]}`;
  return `${languages.slice(0, -1).join(", ")}, and ${languages[languages.length - 1]}`;
}
