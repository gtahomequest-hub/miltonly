"use client";

import type { Stat, CallToAction } from "./_types";
import { ABOUT_EVENTS, fireAboutEvent } from "./_tracking";

interface HeroSectionProps {
  name: string;
  /** Subhead line. Locked spec per DEC-ABOUT-CANONICAL 2026-05-19:
   *  award title + Ontario-wide framing + "{yearsExperience} years
   *  from {primaryCity}" — composed by page.tsx from config so all
   *  three tokens stay in lockstep with config.realtor. */
  subhead: string;
  /** 4 stat tiles, rendered 2x2 on mobile / 4-col on desktop. Tiles
   *  with `value: "—"` render in the "coming shortly" muted state. */
  stats: Stat[];
  primaryCta: CallToAction;
  secondaryCta: CallToAction;
  /** Empty string renders the grey placeholder. Once asset lands,
   *  page.tsx passes the public path and this swaps to next/image. */
  headshotPath: string;
  headshotAlt: string;
  /** Hall of Fame badge label. Text-only until the licensed graphic
   *  arrives (DEC-ABOUT-CANONICAL: never improvise the trademark). */
  badgeLabel: string;
}

/**
 * Above-the-fold hero. Mobile-first: badge → name → subhead →
 * headshot placeholder → 2x2 stats → stacked CTAs. Desktop reflows
 * to two-column with headshot on the left.
 *
 * Stats expected to be muted "—" for null values per locked spec.
 * Component renders whatever the parent composes — no fallback logic.
 */
export default function HeroSection(props: HeroSectionProps) {
  const isPlaceholder = !props.headshotPath;

  return (
    <section
      data-section="about-hero"
      aria-labelledby="about-hero-heading"
      className="bg-[#07111f] text-[#f8f9fb]"
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10 sm:py-14 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] lg:gap-10 gap-6 items-center">
          {/* Headshot — mobile: centered above name; desktop: left column. */}
          <div className="flex justify-center lg:justify-start">
            {isPlaceholder ? (
              <div
                role="img"
                aria-label="Photo pending"
                className="w-[140px] h-[140px] lg:w-[280px] lg:h-[280px] rounded-full bg-[#0a1628] border border-[#1e3a5f] flex items-center justify-center"
              >
                <span className="text-[11px] uppercase tracking-[1.5px] text-[#64748b]">
                  Photo pending
                </span>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={props.headshotPath}
                alt={props.headshotAlt}
                className="w-[140px] h-[140px] lg:w-[280px] lg:h-[280px] rounded-full object-cover border border-[#1e3a5f]"
                loading="eager"
              />
            )}
          </div>

          {/* Right column: badge, name, subhead, stats, CTAs. */}
          <div className="text-center lg:text-left">
            {props.badgeLabel ? (
              <div className="inline-flex items-center gap-1.5 bg-[#0a1628] border border-[#f59e0b]/30 rounded-full px-3 py-1.5 mb-4">
                <span className="text-[14px]" aria-hidden>
                  🏆
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#f59e0b]">
                  {props.badgeLabel}
                </span>
              </div>
            ) : null}

            <h1
              id="about-hero-heading"
              className="text-[clamp(30px,6vw,48px)] font-extrabold leading-[1.05] tracking-[-0.03em] mb-2"
            >
              {props.name}
            </h1>

            <p className="text-[14px] sm:text-[15px] text-[#94a3b8] leading-relaxed mb-5 lg:mb-6 max-w-[560px] lg:max-w-none mx-auto lg:mx-0">
              {props.subhead}
            </p>

            {/* 2x2 mobile / 4-col desktop stat tiles. */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-6">
              {props.stats.map((stat) => {
                const muted = stat.value === "—";
                return (
                  <div
                    key={stat.label}
                    className={`bg-[#0a1628] border rounded-xl p-3 sm:p-4 text-left ${
                      muted ? "border-[#1e3a5f]/60" : "border-[#1e3a5f]"
                    }`}
                  >
                    <div
                      className={`text-[22px] sm:text-[26px] lg:text-[28px] font-extrabold leading-none ${
                        muted ? "text-[#64748b]" : "text-[#fbbf24]"
                      }`}
                    >
                      {stat.value}
                    </div>
                    <div className="text-[10px] sm:text-[11px] uppercase tracking-[1.2px] text-[#94a3b8] mt-1.5">
                      {stat.label}
                    </div>
                    {stat.sub ? (
                      <div className="text-[10px] text-[#64748b] mt-1">{stat.sub}</div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {/* CTAs — stacked on mobile, side-by-side on desktop. */}
            <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 max-w-[420px] mx-auto lg:mx-0 lg:max-w-none">
              <a
                href={props.primaryCta.href}
                onClick={() => fireAboutEvent(ABOUT_EVENTS.heroCtaPrimaryClick)}
                className="inline-flex items-center justify-center bg-[#f59e0b] hover:bg-[#fbbf24] text-[#07111f] font-extrabold text-[15px] px-6 py-3.5 rounded-lg transition-colors min-h-[52px]"
              >
                {props.primaryCta.label}
              </a>
              <a
                href={props.secondaryCta.href}
                onClick={() => fireAboutEvent(ABOUT_EVENTS.heroCtaPhoneClick)}
                className="inline-flex items-center justify-center bg-transparent border-2 border-[#f59e0b] text-[#f59e0b] hover:bg-[#f59e0b]/10 font-extrabold text-[15px] px-6 py-3.5 rounded-lg transition-colors min-h-[52px]"
              >
                {props.secondaryCta.label}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
