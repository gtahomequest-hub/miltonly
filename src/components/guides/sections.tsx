// src/components/guides/sections.tsx
import type { GuidesIndexData, GuideArticleData, GuideTeaser, GuideCta } from './types';
import { CategoryIcon, IconClock, IconBulb, IconCheck } from './icons';

function TeaserCard({ g }: { g: GuideTeaser }) {
  return (
    <a className="g-card" href={`/guides/${g.slug}`}>
      <span className={`g-chip g-chip-${g.category}`}>{g.categoryLabel}</span>
      <div className="g-card-t">{g.title}</div>
      <div className="g-card-d">{g.dek}</div>
      <div className="g-card-m">
        <IconClock /> {g.readMinutes} min read · {g.updated}
      </div>
    </a>
  );
}

/* ---------- guides hub index ---------- */

export function GuidesHero({ data }: { data: GuidesIndexData }) {
  return (
    <header className="g-hero">
      <div className="g-wrap">
        <div className="g-crumb">
          <a href="/">Miltonly</a>
          <span>/</span>
          Guides
        </div>
        <div className="g-hero-grid">
          <div>
            <span className="g-eyebrow">Milton, explained</span>
            <h1>{data.heading}</h1>
            <p className="g-sub">{data.sub}</p>
            <div className="g-statline">
              {data.stats.map((s) => (
                <div className="g-stat" key={s.l}>
                  <div className="g-stat-n">{s.n}</div>
                  <div className="g-stat-l">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
          {data.featured && (
            <a className="g-feat" href={`/guides/${data.featured.slug}`}>
              <span className="g-feat-tag">Featured guide</span>
              <div className="g-feat-t">{data.featured.title}</div>
              <div className="g-feat-d">{data.featured.dek}</div>
              <div className="g-feat-m">
                <IconClock /> {data.featured.readMinutes} min read · {data.featured.updated}
              </div>
            </a>
          )}
        </div>
      </div>
    </header>
  );
}

export function GuidesCategories({ data }: { data: GuidesIndexData }) {
  return (
    <>
      {data.categories.map((c, i) => (
        <section className={`g-block${i % 2 === 1 ? ' g-alt' : ''}`} key={c.key}>
          <div className="g-wrap">
            <div className="g-sechead g-cat-head">
              <span className="g-cat-ic">
                <CategoryIcon k={c.key} />
              </span>
              <div>
                <span className="g-eyebrow">{c.blurb}</span>
                <h2>{c.label}</h2>
              </div>
            </div>
            <div className="g-grid">
              {c.guides.map((g) => (
                <TeaserCard key={g.slug} g={g} />
              ))}
            </div>
          </div>
        </section>
      ))}
    </>
  );
}

/* ---------- guide article ---------- */

export function GuideHero({ data }: { data: GuideArticleData }) {
  return (
    <header className="g-hero">
      <div className="g-wrap">
        <div className="g-crumb">
          <a href="/">Miltonly</a>
          <span>/</span>
          <a href="/guides">Guides</a>
          <span>/</span>
          {data.title}
        </div>
        <span className="g-eyebrow">{data.category.label}</span>
        <h1>{data.title}</h1>
        <p className="g-sub">{data.dek}</p>
        <div className="g-meta">
          <span>
            <IconClock /> {data.readMinutes} min read
          </span>
          <span>Updated {data.updated}</span>
        </div>
      </div>
    </header>
  );
}

export function GuideTakeaways({ data }: { data: GuideArticleData }) {
  if (data.takeaways.length === 0) return null;
  return (
    <div className="g-take">
      <div className="g-wrap">
        <div className="g-take-card">
          <div className="g-take-l">The short version</div>
          <ul>
            {data.takeaways.map((t, i) => (
              <li key={i}>
                <IconCheck />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function GuideBody({ data }: { data: GuideArticleData }) {
  return (
    <section className="g-block">
      <div className="g-wrap g-narrow">
        {data.sections.map((s, i) => (
          <div className="g-sec" key={i}>
            <h2>{s.heading}</h2>
            {s.paragraphs.map((p, j) => (
              <p key={j}>{p}</p>
            ))}
            {s.tip && (
              <div className="g-tip">
                <IconBulb />
                <div>
                  <span className="g-tip-l">Worth knowing</span>
                  {s.tip}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export function GuideFaqs({ data }: { data: GuideArticleData }) {
  if (data.faqs.length === 0) return null;
  return (
    <section className="g-block g-alt">
      <div className="g-wrap">
        <div className="g-sechead">
          <span className="g-eyebrow">Common questions</span>
          <h2>Asked all the time</h2>
        </div>
        <div className="g-faq">
          {data.faqs.map((f, i) => (
            <div className="g-faq-item" key={i}>
              <div className="g-faq-q">{f.question}</div>
              <div className="g-faq-a">{f.answer}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function GuideRelated({ data }: { data: GuideArticleData }) {
  return (
    <section className="g-block">
      <div className="g-wrap">
        <a className="g-parent" href="/guides">
          ← All guides
        </a>
        {data.related.length > 0 && (
          <>
            <div className="g-sechead">
              <span className="g-eyebrow">Keep reading</span>
              <h2>Related guides</h2>
            </div>
            <div className="g-grid">
              {data.related.map((g) => (
                <TeaserCard key={g.slug} g={g} />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/* ---------- shared ---------- */

export function GuidesDualCta({
  eyebrow,
  buyer,
  seller,
}: {
  eyebrow: string;
  buyer: GuideCta;
  seller: GuideCta;
}) {
  return (
    <section className="g-block">
      <div className="g-wrap">
        <div className="g-dual">
          <span className="g-eyebrow" style={{ color: 'var(--g-green)' }}>
            {eyebrow}
          </span>
          <div className="g-dualgrid" style={{ marginTop: 24 }}>
            <div className="g-dcard">
              <h3>{buyer.heading}</h3>
              <p>{buyer.body}</p>
              <a className="g-b2" href={buyer.href}>
                {buyer.buttonLabel} →
              </a>
            </div>
            <div className="g-dcard">
              <h3>{seller.heading}</h3>
              <p>{seller.body}</p>
              <a className="g-b1" href={seller.href}>
                {seller.buttonLabel} →
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}