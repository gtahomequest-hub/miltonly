"use client";

import { useEffect, useRef, useState } from "react";

export interface PhotoLightboxProps {
  photos: string[];
  isOpen: boolean;
  initialIndex?: number;
  onClose: () => void;
}

// Touch swipe threshold in px. ~50 picks up an intentional flick without
// firing on a tap-and-drag that ends up <30px (which iOS Safari can produce
// on a slightly-imprecise tap).
const SWIPE_THRESHOLD = 50;

export default function PhotoLightbox({
  photos,
  isOpen,
  initialIndex = 0,
  onClose,
}: PhotoLightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef<number>(0);

  // Re-sync index when initialIndex changes (a different thumbnail was
  // clicked). Without this, the lightbox would stick on the first photo
  // every reopen.
  useEffect(() => {
    if (isOpen) setIndex(initialIndex);
  }, [isOpen, initialIndex]);

  // Body scroll lock + keyboard nav. Cleanup on close restores scroll.
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + photos.length) % photos.length);
      else if (e.key === "ArrowRight") setIndex((i) => (i + 1) % photos.length);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, photos.length, onClose]);

  if (!isOpen || photos.length === 0) return null;

  const total = photos.length;
  const prev = () => setIndex((i) => (i - 1 + total) % total);
  const next = () => setIndex((i) => (i + 1) % total);

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  }
  function onTouchMove(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  }
  function onTouchEnd() {
    if (touchStartX.current === null) return;
    const delta = touchDeltaX.current;
    touchStartX.current = null;
    touchDeltaX.current = 0;
    if (Math.abs(delta) < SWIPE_THRESHOLD) return;
    if (delta > 0) prev();
    else next();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${index + 1} of ${total}`}
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
      onClick={(e) => {
        // Only close if the backdrop itself was clicked, not the image.
        if (e.target === e.currentTarget) onClose();
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Close (top-right) */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close photo viewer"
        className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 inline-flex items-center justify-center w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl leading-none transition-colors"
      >
        ×
      </button>

      {/* Photo counter (top-left) */}
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10 bg-white/10 backdrop-blur text-white text-[12px] sm:text-[13px] font-semibold tracking-wider px-3 py-1.5 rounded-full">
        {index + 1} of {total}
      </div>

      {/* Prev arrow */}
      {total > 1 && (
        <button
          type="button"
          onClick={prev}
          aria-label="Previous photo"
          className="hidden sm:inline-flex absolute left-4 top-1/2 -translate-y-1/2 z-10 items-center justify-center w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white text-3xl leading-none transition-colors"
        >
          ‹
        </button>
      )}

      {/* Photo */}
      {/* Plain <img> is intentional here: lightbox shows already-loaded
          high-res CDN URLs at intrinsic size; next/image would force LCP
          treatment and re-optimization on every nav. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photos[index]}
        alt={`Photo ${index + 1} of ${total}`}
        className="max-h-[88vh] max-w-[94vw] object-contain select-none"
        draggable={false}
      />

      {/* Next arrow */}
      {total > 1 && (
        <button
          type="button"
          onClick={next}
          aria-label="Next photo"
          className="hidden sm:inline-flex absolute right-4 top-1/2 -translate-y-1/2 z-10 items-center justify-center w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white text-3xl leading-none transition-colors"
        >
          ›
        </button>
      )}

      {/* Mobile prev/next — bottom row, larger tap targets */}
      {total > 1 && (
        <div className="sm:hidden absolute bottom-6 inset-x-0 flex items-center justify-center gap-6 z-10">
          <button
            type="button"
            onClick={prev}
            aria-label="Previous photo"
            className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/15 active:bg-white/25 text-white text-3xl leading-none"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next photo"
            className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/15 active:bg-white/25 text-white text-3xl leading-none"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
