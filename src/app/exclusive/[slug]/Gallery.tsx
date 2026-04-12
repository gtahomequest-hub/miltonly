"use client";

import { useState, useEffect, useCallback } from "react";

interface Props {
  photos: string[];
  title: string;
}

export default function Gallery({ photos, title }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const goPrev = useCallback(() => {
    setActiveIdx((i) => (i - 1 + photos.length) % photos.length);
  }, [photos.length]);

  const goNext = useCallback(() => {
    setActiveIdx((i) => (i + 1) % photos.length);
  }, [photos.length]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightboxOpen, goPrev, goNext]);

  if (photos.length === 0) {
    return (
      <div className="w-full aspect-[16/9] bg-[#0c1e35] flex items-center justify-center">
        <p className="text-[#94a3b8] text-[14px]">No photos yet</p>
      </div>
    );
  }

  const active = photos[activeIdx];

  return (
    <>
      {/* Main photo */}
      <div className="relative bg-[#0c1e35]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={active}
          alt={`${title} photo ${activeIdx + 1}`}
          className="w-full max-h-[520px] object-cover cursor-pointer"
          onClick={() => setLightboxOpen(true)}
        />
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="absolute bottom-4 right-4 bg-black/70 text-white text-[12px] font-semibold px-3 py-1.5 rounded-lg hover:bg-black/90"
        >
          🔍 View gallery ({photos.length})
        </button>
      </div>

      {/* Thumbnail strip */}
      {photos.length > 1 && (
        <div className="bg-white border-b border-[#e2e8f0]">
          <div className="max-w-6xl mx-auto px-5 py-3 flex gap-2 overflow-x-auto scrollbar-thin">
            {photos.map((p, i) => (
              <button
                key={`${p}-${i}`}
                type="button"
                onClick={() => setActiveIdx(i)}
                className={`shrink-0 h-[80px] w-[110px] rounded-lg overflow-hidden border-2 transition-colors ${
                  i === activeIdx ? "border-[#f59e0b]" : "border-transparent hover:border-[#e2e8f0]"
                }`}
                aria-label={`Photo ${i + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p} alt={`Thumbnail ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={active}
            alt={`${title} photo ${activeIdx + 1}`}
            className="max-w-[92vw] max-h-[86vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white text-[20px] flex items-center justify-center"
            aria-label="Close"
          >
            ✕
          </button>

          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goPrev();
                }}
                className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white text-[24px] flex items-center justify-center"
                aria-label="Previous photo"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goNext();
                }}
                className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white text-[24px] flex items-center justify-center"
                aria-label="Next photo"
              >
                ›
              </button>
            </>
          )}

          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-white/10 text-white text-[13px] font-semibold px-4 py-1.5 rounded-full">
            {activeIdx + 1} / {photos.length}
          </div>
        </div>
      )}
    </>
  );
}
