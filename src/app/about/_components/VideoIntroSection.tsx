"use client";

import { useState } from "react";
import { ABOUT_EVENTS, fireAboutEvent } from "./_tracking";

interface VideoIntroSectionProps {
  /** Path to MP4 (Vercel Blob URL or /public path). Null until Aamir
   *  delivers item B12 — section renders the poster placeholder until
   *  then but stays visually present so the page rhythm is locked. */
  videoPath: string | null;
  /** Poster frame still. Renders even when videoPath is null. Empty
   *  string falls back to a styled placeholder div. */
  posterPath: string;
  posterAlt: string;
  /** WebVTT captions path. Required when videoPath is set per the
   *  accessibility + silent-autoplay-friendly spec. */
  captionsPath: string | null;
  /** Optional transcript text. When present, renders as a collapsible
   *  fallback for screen readers and SEO. */
  transcript: string;
  /** Eyebrow above heading, e.g. "60-second intro". */
  eyebrow: string;
  /** Section heading, e.g. "Meet Aamir". */
  heading: string;
}

/**
 * 30-60 second intro video, scaffolded with poster placeholder per
 * gate spec. Visual implementation lives here; lazy <video> mount +
 * 80% completion observer land in a later gate once Aamir delivers
 * the MP4.
 */
export default function VideoIntroSection(props: VideoIntroSectionProps) {
  const [played, setPlayed] = useState(false);
  const hasVideo = Boolean(props.videoPath);
  const hasPoster = Boolean(props.posterPath);

  function onPlayClick() {
    if (played || !hasVideo) return;
    fireAboutEvent(ABOUT_EVENTS.videoIntroPlay);
    setPlayed(true);
    // TODO: swap the poster card for a <video> element on next render
    // once Aamir delivers the MP4 + WebVTT captions (item B12).
  }

  return (
    <section
      data-section="about-video"
      aria-labelledby="about-video-heading"
      className="bg-[#f8f9fb]"
    >
      <div className="max-w-4xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
        <div className="text-center mb-6 sm:mb-8">
          <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#f59e0b] mb-2">
            {props.eyebrow}
          </div>
          <h2
            id="about-video-heading"
            className="text-[24px] sm:text-[28px] font-extrabold text-[#07111f] tracking-[-0.02em]"
          >
            {props.heading}
          </h2>
        </div>

        {/* 16:9 poster card. Click target only active when videoPath set. */}
        <div
          className="relative aspect-video bg-[#0a1628] rounded-xl overflow-hidden border border-[#1e3a5f]"
          data-role="poster"
        >
          {hasPoster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={props.posterPath}
              alt={props.posterAlt}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[12px] uppercase tracking-[1.5px] text-[#64748b]">
                Poster pending
              </span>
            </div>
          )}

          {/* Play overlay — disabled state when no video yet. */}
          <button
            type="button"
            onClick={onPlayClick}
            disabled={!hasVideo}
            aria-label={hasVideo ? "Play intro video" : "Intro video coming shortly"}
            className="absolute inset-0 flex items-center justify-center bg-[#07111f]/40 hover:bg-[#07111f]/55 disabled:hover:bg-[#07111f]/40 transition-colors group"
          >
            <span
              className={`flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full ${
                hasVideo
                  ? "bg-[#f59e0b] group-hover:bg-[#fbbf24]"
                  : "bg-[#1e3a5f] cursor-not-allowed"
              } transition-colors`}
            >
              <span className="text-[26px] sm:text-[30px] text-[#07111f] ml-1.5" aria-hidden>
                ▶
              </span>
            </span>
          </button>

          {!hasVideo ? (
            <div className="absolute bottom-3 left-0 right-0 text-center">
              <span className="inline-block bg-[#07111f]/85 text-[#f8f9fb] text-[11px] uppercase tracking-[1.5px] px-3 py-1.5 rounded-full">
                Intro video coming shortly
              </span>
            </div>
          ) : null}
        </div>

        {props.transcript ? (
          <details className="mt-4 text-[13px] text-[#64748b]">
            <summary className="cursor-pointer font-semibold text-[#07111f]">
              Read transcript
            </summary>
            <p className="mt-2 leading-relaxed whitespace-pre-line">
              {props.transcript}
            </p>
          </details>
        ) : null}
      </div>
    </section>
  );
}
