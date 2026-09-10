// src/components/home/VideoStreets.tsx
// The strip of streets we have actually filmed.
//
// This is the one thing on the homepage that no competitor can copy this quarter, so it
// sits above the listings rather than below them: a visitor who has never heard of the
// site learns in one glance that we went and drove the streets. Each frame is a link to
// that street's page, so the section is also 10 internal links to 10 deep pages.
//
// EVERY CARD IS A REAL POSTER FRAME. getStreetsWithVideo drops any row whose poster URL
// cannot be derived, so there is no placeholder tile and no grey box. If the strip is
// empty it does not render at all — an empty carousel is worse than no carousel.
import type { StreetVideoCard } from '@/lib/homeSignals';
import { SectionHead } from './SectionHead';

interface Props {
  streets: StreetVideoCard[];
  total: number;
}

export function VideoStreets({ streets, total }: Props) {
  if (streets.length === 0) return null;
  return (
    <section className="mh-sec mh-video" id="video">
      <div className="m-wrap">
        <SectionHead
          index="01"
          title="Streets on film"
          standfirst={`${total} Milton streets filmed end to end. Watch the street before you book the showing: the parking, the setbacks, the tree cover, the light.`}
          action={{ href: '/streets', label: 'All streets' }}
        />
        <ul className="mh-filmstrip">
          {streets.map((s) => (
            <li key={s.slug}>
              <a href={`/streets/${s.slug}`}>
                <span className="mh-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.poster} alt={`${s.name}, Milton`} loading="lazy" width={320} height={180} />
                  {s.variant === 'night' ? <span className="mh-nightmark">Overnight</span> : null}
                </span>
                <span className="mh-framename">{s.name}</span>
                {s.capturedAt ? <span className="mh-framedate">Captured {s.capturedAt}</span> : null}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default VideoStreets;
