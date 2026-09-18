"use client";

import { useEffect } from "react";
import { GA_ID } from "@/lib/analytics";

// THE TAGS LOAD AFTER THE PAGE, NOT BEFORE IT (MH-005, MA-001 change 3).
//
// Google's gtag.js (188 KB, 226 ms of main thread) and the Meta pixel (192 KB, 682 ms) were
// `afterInteractive` scripts on every route: they ran inside the LCP and TBT window on a
// phone, on pages where a visitor had not touched anything. Now the page ships two inline
// STUBS that queue every call (`gtag(...)` pushes onto dataLayer, `fbq(...)` onto its own
// queue, exactly the shape both vendors' loaders expect), and the real scripts are injected
// on the first interaction (a pointer, a key, a touch, a scroll) or, failing one, when the
// browser is idle a few seconds after load. Nothing that calls window.gtag or window.fbq has
// to change: the stub is there from the first byte, and the vendor script replays the queue.
//
// The mount gates are the ones the two components carried: a GA id, and for the pixel a
// production build or the debug flag.

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const pixelOn = !!PIXEL_ID && (process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_META_PIXEL_DEBUG === "true");
const gaOn = !!GA_ID;

/** How long after `load` an untouched page waits before loading the tags anyway. */
const IDLE_AFTER_LOAD_MS = 6000;

function inject(src: string, id: string) {
  if (document.getElementById(id)) return;
  const s = document.createElement("script");
  s.id = id;
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

export function DeferredTagLoader() {
  useEffect(() => {
    if (!gaOn && !pixelOn) return;
    let fired = false;
    const fire = () => {
      if (fired) return;
      fired = true;
      if (gaOn) inject(`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`, "gtag-js");
      if (pixelOn) inject("https://connect.facebook.net/en_US/fbevents.js", "fbevents-js");
      cleanup();
    };
    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart", "scroll"];
    const opts: AddEventListenerOptions = { passive: true, once: true };
    let timer: number | null = null;
    let idle: number | null = null;
    const afterLoad = () => {
      timer = window.setTimeout(() => {
        if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(fire, { timeout: 2000 });
        else fire();
      }, IDLE_AFTER_LOAD_MS);
    };
    const cleanup = () => {
      for (const e of events) window.removeEventListener(e, fire);
      if (timer !== null) window.clearTimeout(timer);
      if (idle !== null && typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
      window.removeEventListener("load", afterLoad);
    };
    for (const e of events) window.addEventListener(e, fire, opts);
    if (document.readyState === "complete") afterLoad();
    else window.addEventListener("load", afterLoad, { once: true });
    return cleanup;
  }, []);
  return null;
}

/** The stubs, server-rendered so they exist before any script on the page can call them. */
export function TagStubs() {
  const parts: string[] = [];
  if (gaOn) {
    parts.push(
      `window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){dataLayer.push(arguments)};gtag('js',new Date());gtag('config','${GA_ID}');`,
    );
  }
  if (pixelOn) {
    // The vendor's own bootstrap minus the script insertion, which DeferredTagLoader does later.
    parts.push(
      `!function(f,n){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[]}(window);fbq('init','${PIXEL_ID}');fbq('track','PageView');`,
    );
  }
  if (parts.length === 0) return null;
  return (
    <>
      <script id="tag-stubs" dangerouslySetInnerHTML={{ __html: parts.join("") }} />
      {pixelOn ? (
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img height="1" width="1" style={{ display: "none" }} src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`} alt="" />
        </noscript>
      ) : null}
    </>
  );
}
