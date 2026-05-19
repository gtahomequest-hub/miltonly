"use client";

import { useEffect, useRef } from "react";
import { ABOUT_EVENTS, fireAboutEvent } from "./_tracking";

interface ServiceAreaSectionProps {
  /** SEO/schema weighting only — NOT a service-area boundary. */
  primaryCity: string;
  licensedRegion: string;
  display: string;
  subtext: string;
  /** Google Maps embed URL. Defaults to a province-wide Ontario view
   *  with no API key (legacy maps.google.com/maps?output=embed form).
   *  Caller may override to swap zoom or center. */
  mapEmbedUrl?: string;
}

const DEFAULT_MAP_EMBED =
  "https://maps.google.com/maps?q=Ontario%2C+Canada&z=5&output=embed&hl=en";

/**
 * Province-wide service-area section. Locked framing per
 * DEC-ABOUT-CANONICAL 2026-05-19: Ontario service, Milton as a
 * home-base anchor only. Map must read as province-wide — never as
 * a Milton-shaded polygon.
 *
 * Google Maps Embed used per D4 — no API key, no Mapbox token
 * plumbing. iframe is lazy-loaded by the browser; visibility tracking
 * via IntersectionObserver fires service_area_map_view once when the
 * section first enters the viewport.
 */
export default function ServiceAreaSection(props: ServiceAreaSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const fired = useRef(false);
  const embedUrl = props.mapEmbedUrl ?? DEFAULT_MAP_EMBED;

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !fired.current) {
            fired.current = true;
            fireAboutEvent(ABOUT_EVENTS.serviceAreaMapView);
            io.disconnect();
          }
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      data-section="about-service-area"
      aria-labelledby="about-area-heading"
      data-licensed-region={props.licensedRegion}
      data-primary-city={props.primaryCity}
      className="bg-[#07111f] text-[#f8f9fb]"
    >
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
        <div className="text-center mb-6 sm:mb-8">
          <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#f59e0b] mb-2">
            Service area
          </div>
          <h2
            id="about-area-heading"
            className="text-[24px] sm:text-[28px] font-extrabold tracking-[-0.02em] mb-3"
          >
            {props.display}
          </h2>
          <p className="text-[13px] sm:text-[14px] text-[#94a3b8] max-w-[560px] mx-auto leading-relaxed">
            {props.subtext}
          </p>
        </div>

        <div className="rounded-xl overflow-hidden border border-[#1e3a5f] aspect-[16/10] sm:aspect-[16/9] bg-[#0a1628]">
          <iframe
            src={embedUrl}
            title={`Map of ${props.licensedRegion}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
            className="w-full h-full border-0"
          />
        </div>

        <p className="text-center text-[12px] text-[#64748b] mt-3">
          Home base: {props.primaryCity}.
        </p>
      </div>
    </section>
  );
}
