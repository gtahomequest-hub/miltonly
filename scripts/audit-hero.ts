// Puppeteer-based pixel audit for /sales/ads/[mlsNumber] hero rebuild.
//
// Drives headless Chromium against the deployed URL at three viewports
// (1440 / 768 / 375), captures bounds + spacing + typography + contrast
// ratios + LCP/CLS + sticky-scroll + lightbox interaction. Outputs JSON
// per viewport and a markdown summary to audit-reports/.
//
// Run:
//   pnpm audit:hero                                    # default URL + all viewports
//   pnpm audit:hero -- --url <url>                     # different listing
//   pnpm audit:hero -- --viewport 1440                 # single viewport
//   pnpm audit:hero -- --headed                        # debug: show the browser
//
// Exit codes:
//   0 — PASS (no sanity violations, LCP is hero photo, contrast all pass)
//   1 — SOFT FAIL (1–3 minor issues, none of S8/S11/S15 critical)
//   2 — HARD FAIL (critical violation, LCP regression, contrast fail,
//       missing required element, or console errors)
//
// The harness is read-only against the live page. It clicks the "+N more"
// lightbox CTA once and dispatches Tab keys to capture focus order; nothing
// is submitted.

import puppeteer, { Browser } from "puppeteer";
import fs from "fs/promises";
import path from "path";

const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900, isDesktop: true },
  { name: "768", width: 768, height: 1024, isDesktop: false },
  { name: "375", width: 375, height: 812, isDesktop: false },
] as const;
type Viewport = (typeof VIEWPORTS)[number];

const DEFAULT_URL = "https://www.miltonly.com/sales/ads/W13120162";
const OUTPUT_DIR = path.resolve(process.cwd(), "audit-reports");

// Computed style props we read per element. Kept lean so the page.evaluate
// payload stays small.
const STYLE_PROPS = [
  "font-size",
  "line-height",
  "font-family",
  "color",
  "background-color",
  "border-color",
  "position",
  "display",
] as const;

interface Args {
  url: string;
  viewport: "all" | "1440" | "768" | "375";
  headed: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let url = DEFAULT_URL;
  let viewport: Args["viewport"] = "all";
  let headed = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--url" && argv[i + 1]) {
      url = argv[++i];
    } else if (a === "--viewport" && argv[i + 1]) {
      const v = argv[++i];
      if (v === "1440" || v === "768" || v === "375") viewport = v;
      else {
        console.error(`Invalid --viewport ${v} (expected 1440|768|375)`);
        process.exit(2);
      }
    } else if (a === "--headed") {
      headed = true;
    } else if (a === "--help" || a === "-h") {
      console.log(
        "Usage: pnpm audit:hero -- [--url <url>] [--viewport 1440|768|375] [--headed]",
      );
      process.exit(0);
    }
  }
  return { url, viewport, headed };
}

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

function slug(u: string): string {
  const last = u.split("?")[0].split("/").filter(Boolean).pop() || "page";
  return last.replace(/[^A-Za-z0-9_-]/g, "_");
}

// ─── WCAG contrast helpers (run in Node, not in the page) ──────────────────

function rgbFromCss(s: string | null | undefined): [number, number, number] | null {
  if (!s) return null;
  const m = s.match(/rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/);
  if (!m) return null;
  return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])];
}

function relLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(fg: string | null | undefined, bg: string | null | undefined): number | null {
  const f = rgbFromCss(fg);
  const b = rgbFromCss(bg);
  if (!f || !b) return null;
  const L1 = Math.max(relLuminance(f), relLuminance(b));
  const L2 = Math.min(relLuminance(f), relLuminance(b));
  return (L1 + 0.05) / (L2 + 0.05);
}

// ─── Per-viewport runner ────────────────────────────────────────────────────

async function runViewport(browser: Browser, url: string, vp: Viewport) {
  const page = await browser.newPage();
  await page.setViewport({
    width: vp.width,
    height: vp.height,
    deviceScaleFactor: 1,
    isMobile: !vp.isDesktop,
    hasTouch: !vp.isDesktop,
  });

  // Install LCP + CLS observers before navigation so they capture the full
  // lifecycle. The observed entries are stashed on window.__perf and read
  // back below.
  await page.evaluateOnNewDocument(() => {
    interface Perf {
      lcp: number | null;
      lcpTag: string | null;
      lcpAlt: string | null;
      lcpClass: string | null;
      lcpId: string | null;
      cls: number;
    }
    const w = window as unknown as { __perf: Perf };
    w.__perf = { lcp: null, lcpTag: null, lcpAlt: null, lcpClass: null, lcpId: null, cls: 0 };
    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const e of entries) {
          // The LCP entry's `element` is the LCP element ref (any HTMLElement).
          const lcpEntry = e as PerformanceEntry & { element?: HTMLElement; startTime: number };
          w.__perf.lcp = lcpEntry.startTime;
          const el = lcpEntry.element;
          if (el) {
            w.__perf.lcpTag = el.tagName;
            w.__perf.lcpAlt = (el as HTMLImageElement).alt || null;
            w.__perf.lcpClass = (el.className || "").toString().slice(0, 80);
            w.__perf.lcpId = el.id || null;
          }
        }
      }).observe({ type: "largest-contentful-paint", buffered: true });
    } catch (e) {
      // ignore
    }
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as PerformanceEntry[] & { value?: number; hadRecentInput?: boolean }[]) {
          const shift = e as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
          if (!shift.hadRecentInput && typeof shift.value === "number") {
            w.__perf.cls += shift.value;
          }
        }
      }).observe({ type: "layout-shift", buffered: true });
    } catch (e) {
      // ignore
    }
  });

  const consoleMessages: { type: string; text: string }[] = [];
  page.on("console", (msg) => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });
  page.on("pageerror", (err) => {
    consoleMessages.push({ type: "pageerror", text: err.message });
  });

  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
  // Let LCP settle.
  await new Promise((r) => setTimeout(r, 1500));

  // ─── Bulk DOM read: bounds + computed styles + colors + form attrs ──
  const data = await page.evaluate((styleProps: readonly string[]) => {
    function rect(el: Element | null) {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      // Adjust top/bottom for current scroll so values are page-relative.
      const sy = window.scrollY;
      return {
        top: r.top + sy,
        right: r.right,
        bottom: r.bottom + sy,
        left: r.left,
        width: r.width,
        height: r.height,
      };
    }
    function computed(el: Element | null) {
      if (!el) return null;
      const cs = getComputedStyle(el);
      const out: Record<string, string> = {};
      for (const p of styleProps) out[p] = cs.getPropertyValue(p).trim();
      return out;
    }
    function visible(el: Element | null): boolean {
      if (!el) return false;
      const cs = getComputedStyle(el);
      return cs.display !== "none" && cs.visibility !== "hidden";
    }

    // Header — first <header> in document.
    const header = document.querySelector("header.sticky") as HTMLElement | null;

    // Three ordered sections in the page body. The /sales/ads/[mlsNumber]
    // rebuild emits, in order: hero photos, facts band, description+form.
    // Below those sit the LiveListingSlider (aria-label="Milton listings
    // carousel"), the two-reports band, the why-with-Aamir band, footer.
    const allSections = Array.from(document.querySelectorAll("section"));
    const heroSection = allSections[0] || null;
    const factsSection = allSections[1] || null;
    const twoColSection = allSections[2] || null;
    const sliderSection =
      (document.querySelector('section[aria-label*="Milton listings carousel"]') as HTMLElement | null) ||
      allSections[3] ||
      null;

    // Hero internals — selected by aria-label so they're robust to class drift.
    const primaryPhotoBtn = heroSection?.querySelector(
      'button[aria-label*="Open photo viewer"]',
    ) as HTMLElement | null;
    const primaryPhotoImg = primaryPhotoBtn?.querySelector("img") as HTMLImageElement | null;
    const newPill = primaryPhotoBtn?.querySelector("span.top-3.left-3") as HTMLElement | null;
    const counterPill = primaryPhotoBtn?.querySelector("span.top-3.right-3") as HTMLElement | null;

    const desktopThumb1 = heroSection?.querySelector(
      'button[aria-label="Open photo 2"]',
    ) as HTMLElement | null;
    const desktopThumb2 =
      (heroSection?.querySelector(
        'button[aria-label*="Open all"]',
      ) as HTMLElement | null) ||
      (heroSection?.querySelector(
        'button[aria-label="Open photo 3"]',
      ) as HTMLElement | null);

    // Mobile thumb strip — the visible overflow-x-auto inside hero. Below
    // lg the right-column thumb grid is hidden via `hidden lg:grid` so the
    // strip is the only visible overflow-x-auto child of the hero.
    let mobileThumbStrip: HTMLElement | null = null;
    if (heroSection) {
      const cands = heroSection.querySelectorAll("div.overflow-x-auto");
      for (const c of Array.from(cands)) {
        if (visible(c)) {
          mobileThumbStrip = c as HTMLElement;
          break;
        }
      }
    }
    const mobileStripChildren = mobileThumbStrip
      ? Array.from(mobileThumbStrip.children).map((c) => ({
          tag: c.tagName,
          ariaLabel: (c as HTMLElement).getAttribute("aria-label"),
          rect: rect(c),
        }))
      : [];

    // Facts band internals
    let priceEl: HTMLElement | null = null;
    let addressEl: HTMLElement | null = null;
    let factsRow: HTMLElement | null = null;
    let badgesRow: HTMLElement | null = null;
    const factsInner = factsSection?.querySelector(":scope > div");
    if (factsInner) {
      const rows = Array.from(factsInner.children) as HTMLElement[];
      if (rows[0]) {
        const r0 = Array.from(rows[0].children) as HTMLElement[];
        priceEl = r0[0] || null;
        addressEl = r0[1] || null;
      }
      factsRow = rows[1] || null;
      badgesRow = rows[2] || null;
    }
    const factsItems = factsRow
      ? Array.from(factsRow.querySelectorAll("span")).map((s) => ({
          text: (s as HTMLElement).innerText.trim(),
          rect: rect(s),
        }))
      : [];
    const badgePills = badgesRow
      ? Array.from(badgesRow.querySelectorAll("span")).map((s) => ({
          text: (s as HTMLElement).innerText.trim(),
          rect: rect(s),
        }))
      : [];

    // Two-col section internals
    const formAside = twoColSection?.querySelector("aside") as HTMLElement | null;
    const formCard = formAside?.querySelector(":scope > div") as HTMLElement | null;
    const formHeading = formCard?.querySelector("h3") as HTMLElement | null;
    const firstInput = formCard?.querySelector("input") as HTMLInputElement | null;
    const firstInputLabel = (() => {
      if (!firstInput) return null;
      const id = firstInput.id;
      return id ? (document.querySelector(`label[for="${id}"]`) as HTMLElement | null) : null;
    })();
    const submitBtn = formCard?.querySelector('button[type="submit"]') as HTMLElement | null;
    const trustCard = formAside?.querySelector(":scope > :nth-child(2)") as HTMLElement | null;
    const aboutCard = (() => {
      // The non-aside grid child of twoColSection.
      if (!twoColSection) return null;
      for (const child of Array.from(twoColSection.querySelector(":scope > div")?.children || [])) {
        if (child.tagName.toLowerCase() !== "aside") return child as HTMLElement;
      }
      // Fallback: any direct div sibling of the aside.
      const a = twoColSection.querySelector("aside");
      let sib: Element | null = a?.nextElementSibling || a?.previousElementSibling || null;
      while (sib && sib.tagName.toLowerCase() === "aside") sib = sib.nextElementSibling;
      return (sib as HTMLElement | null) || null;
    })();
    const descriptionP = aboutCard?.querySelector("p") as HTMLElement | null;

    // Sticky mobile bar — direct class match (md:hidden fixed bottom-0).
    // querySelector with escaped colons works in modern browsers.
    let stickyMobileBar = document.querySelector("[data-sticky-bar]") as HTMLElement | null;
    if (!stickyMobileBar) {
      stickyMobileBar = document.querySelector(
        "div.fixed.bottom-0.inset-x-0.z-40",
      ) as HTMLElement | null;
    }

    return {
      header: rect(header),
      heroSection: rect(heroSection),
      factsSection: rect(factsSection),
      twoColSection: rect(twoColSection),
      sliderSection: rect(sliderSection),
      sliderSectionAria: sliderSection?.getAttribute("aria-label") || null,
      primaryPhoto: {
        button: rect(primaryPhotoBtn),
        img: rect(primaryPhotoImg),
        imgAlt: primaryPhotoImg?.alt || null,
        imgComplete: primaryPhotoImg ? primaryPhotoImg.complete && primaryPhotoImg.naturalWidth > 0 : false,
        fetchPriority: primaryPhotoImg?.getAttribute("fetchpriority") || null,
        loading: primaryPhotoImg?.getAttribute("loading") || null,
        decoding: primaryPhotoImg?.getAttribute("decoding") || null,
      },
      newPill: rect(newPill),
      newPillText: newPill?.innerText?.trim() || null,
      counterPill: rect(counterPill),
      counterPillText: counterPill?.innerText?.trim() || null,
      desktopThumb1: { rect: rect(desktopThumb1), visible: visible(desktopThumb1) },
      desktopThumb2: {
        rect: rect(desktopThumb2),
        visible: visible(desktopThumb2),
        ariaLabel: desktopThumb2?.getAttribute("aria-label") || null,
      },
      mobileThumbStrip: { rect: rect(mobileThumbStrip), visible: visible(mobileThumbStrip) },
      mobileStripChildren,
      formAside: { rect: rect(formAside), computed: computed(formAside) },
      formCard: { rect: rect(formCard), computed: computed(formCard) },
      formHeading: { rect: rect(formHeading), computed: computed(formHeading) },
      firstInput: {
        rect: rect(firstInput),
        computed: computed(firstInput),
        attrs: firstInput
          ? {
              type: firstInput.type,
              inputMode: firstInput.getAttribute("inputmode") || firstInput.inputMode || null,
              autocomplete: firstInput.autocomplete,
              name: firstInput.name || null,
              pattern: firstInput.pattern || null,
              required: firstInput.required,
            }
          : null,
      },
      firstInputLabel: { rect: rect(firstInputLabel), computed: computed(firstInputLabel) },
      submitBtn: { rect: rect(submitBtn), computed: computed(submitBtn), text: submitBtn?.innerText?.trim() || null },
      trustCard: { rect: rect(trustCard) },
      aboutCard: { rect: rect(aboutCard) },
      descriptionP: { rect: rect(descriptionP), computed: computed(descriptionP) },
      priceEl: { rect: rect(priceEl), text: priceEl?.innerText?.trim() || null, computed: computed(priceEl) },
      addressEl: {
        rect: rect(addressEl),
        text: addressEl?.innerText?.trim() || null,
        computed: computed(addressEl),
      },
      factsRow: { rect: rect(factsRow), computed: computed(factsRow) },
      badgesRow: { rect: rect(badgesRow) },
      factsItems,
      badgePills,
      stickyMobileBar: { rect: rect(stickyMobileBar), visible: visible(stickyMobileBar) },
      pageBody: { computed: computed(document.body) },
      perf: (window as unknown as { __perf: Record<string, unknown> }).__perf,
      viewport: { innerWidth: window.innerWidth, innerHeight: window.innerHeight },
      scrollHeight: document.documentElement.scrollHeight,
      docTitle: document.title,
    };
  }, STYLE_PROPS);

  // Resource accounting via Performance API (encodedBodySize is reliable).
  const resources = await page.evaluate(() => {
    return (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).map((r) => ({
      name: r.name,
      initiatorType: r.initiatorType,
      encodedBodySize: r.encodedBodySize,
      transferSize: r.transferSize,
      duration: r.duration,
      startTime: r.startTime,
    }));
  });
  const imgResources = resources.filter((r) => r.initiatorType === "img");
  const imageBytes = imgResources.reduce((s, r) => s + (r.encodedBodySize || 0), 0);
  const totalBytes = resources.reduce((s, r) => s + (r.encodedBodySize || 0), 0);
  const firstFiveImages = imgResources
    .sort((a, b) => a.startTime - b.startTime)
    .slice(0, 5)
    .map((r) => ({
      name: r.name.split("?")[0].split("/").pop(),
      bytes: r.encodedBodySize,
      startMs: Math.round(r.startTime),
    }));

  // ─── Sticky-scroll behavior (desktop only — sticky kicks in at lg:) ──
  let stickyTest: unknown = null;
  if (vp.isDesktop) {
    stickyTest = await page.evaluate(async () => {
      const aside = document.querySelector("section:nth-of-type(3) aside") as HTMLElement | null;
      const twoCol = document.querySelector("section:nth-of-type(3)") as HTMLElement | null;
      if (!aside || !twoCol)
        return {
          error: "no-aside-or-twocol",
          asideFound: !!aside,
          twoColFound: !!twoCol,
        };
      const cs = getComputedStyle(aside);
      const stickyDeclared = cs.position === "sticky";
      const initialTop = aside.getBoundingClientRect().top + window.scrollY;
      const step = 100;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      let stuckAt: number | null = null;
      let releasedAt: number | null = null;
      const samples: { scrollY: number; asideTop: number; stuck: boolean }[] = [];
      for (let y = 0; y <= maxScroll; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => requestAnimationFrame(r));
        const r = aside.getBoundingClientRect();
        const stuck = Math.abs(r.top - 80) < 3; // lg:top-[80px]
        if (stuck && stuckAt === null) stuckAt = y;
        if (!stuck && stuckAt !== null && releasedAt === null && y > stuckAt + step) releasedAt = y;
        samples.push({ scrollY: y, asideTop: Math.round(r.top), stuck });
      }
      window.scrollTo(0, 0);
      return {
        stickyDeclared,
        initialTop,
        stuckAt,
        releasedAt,
        sampleCount: samples.length,
        // Trim sample log to first 8 and last 4 for the JSON output.
        samplesHead: samples.slice(0, 8),
        samplesTail: samples.slice(-4),
      };
    });
  }

  // ─── Lightbox interaction ──
  const lightboxTest = await page.evaluate(async () => {
    const desktopBtn = document.querySelector(
      'section:nth-of-type(1) button[aria-label*="Open all"]',
    ) as HTMLElement | null;
    const mobileBtn = (() => {
      const stripBtns = document.querySelectorAll(
        'section:nth-of-type(1) div.overflow-x-auto button[aria-label*="Open all"]',
      );
      for (const b of Array.from(stripBtns)) {
        const cs = getComputedStyle(b.parentElement as Element);
        if (cs.display !== "none") return b as HTMLElement;
      }
      return null;
    })();
    const btn = desktopBtn || mobileBtn;
    if (!btn) {
      return {
        opened: false,
        error: "no-lightbox-cta",
        desktopBtnFound: !!desktopBtn,
        mobileBtnFound: !!mobileBtn,
      };
    }
    const ctaSource = desktopBtn ? "desktop-thumb-2" : "mobile-strip-+more";
    const ctaLabel = btn.getAttribute("aria-label");
    const t0 = performance.now();
    btn.click();
    // Wait up to 1s for the lightbox to appear.
    let lightbox: HTMLElement | null = null;
    const deadline = t0 + 1000;
    while (performance.now() < deadline) {
      await new Promise((r) => requestAnimationFrame(r));
      lightbox =
        (document.querySelector('[role="dialog"]') as HTMLElement | null) ||
        (document.querySelector("div.fixed.inset-0") as HTMLElement | null);
      if (lightbox && (lightbox.offsetWidth > 0 || lightbox.offsetHeight > 0)) break;
    }
    const t1 = performance.now();
    return {
      opened: !!lightbox && (lightbox.offsetWidth > 0 || lightbox.offsetHeight > 0),
      openMs: t1 - t0,
      ctaSource,
      ctaLabel,
    };
  });

  // Close any open lightbox.
  await page.keyboard.press("Escape").catch(() => {});
  await new Promise((r) => setTimeout(r, 200));

  // ─── Tab order (first 8 stops) ──
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    (document.activeElement as HTMLElement | null)?.blur?.();
  });
  const tabOrder: string[] = [];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    const desc = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return "BODY";
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : "";
      const aria = el.getAttribute("aria-label");
      const role = el.getAttribute("role");
      const text = (el.innerText || "").trim().slice(0, 40);
      const type = (el as HTMLInputElement).type;
      return `${tag}${id}${type ? `[type=${type}]` : ""}${role ? ` role=${role}` : ""}${aria ? ` aria="${aria.slice(0, 40)}"` : ""}${text ? ` "${text}"` : ""}`;
    });
    tabOrder.push(`[${i + 1}] ${desc}`);
  }

  await page.close();

  return {
    viewport: { name: vp.name, width: vp.width, height: vp.height },
    url,
    timestamp: new Date().toISOString(),
    data,
    resources: { count: resources.length, imageBytes, totalBytes, firstFiveImages },
    stickyTest,
    lightboxTest,
    tabOrder,
    consoleMessages,
  };
}

// ─── Derived computations: gaps + sanity checks + contrast ─────────────────

type ViewportResult = Awaited<ReturnType<typeof runViewport>>;

function computeGaps(r: ViewportResult) {
  const d = r.data;
  const g: Record<string, number | null> = {};
  const v = (a: { top?: number; bottom?: number; left?: number; right?: number; width?: number; height?: number } | null) =>
    a ?? null;

  const header = v(d.header);
  const hero = v(d.heroSection);
  const facts = v(d.factsSection);
  const twoCol = v(d.twoColSection);
  const slider = v(d.sliderSection);
  const primary = v(d.primaryPhoto.button);
  const desktopThumb1 = v(d.desktopThumb1.rect);
  const desktopThumb2 = v(d.desktopThumb2.rect);
  const strip = v(d.mobileThumbStrip.rect);
  const formCard = v(d.formCard.rect);
  const formHeading = v(d.formHeading.rect);
  const firstInput = v(d.firstInput.rect);
  const submitBtn = v(d.submitBtn.rect);
  const trustCard = v(d.trustCard.rect);
  const priceEl = v(d.priceEl.rect);
  const factsRow = v(d.factsRow.rect);
  const badgesRow = v(d.badgesRow.rect);
  const stickyBar = v(d.stickyMobileBar.rect);

  const sub = (a: typeof header, b: typeof header, fa: "top" | "bottom", fb: "top" | "bottom") =>
    a && b && a[fa] !== undefined && b[fb] !== undefined ? a[fa]! - b[fb]! : null;

  g.G1 = sub(primary, header, "top", "bottom");
  g.G2 = sub(facts, primary, "top", "bottom");
  g.G3 = strip && strip.height ? sub(facts, strip, "top", "bottom") : null;
  g.G4 = sub(factsRow, priceEl, "top", "bottom");
  g.G5 = sub(badgesRow, factsRow, "top", "bottom");
  g.G6 = sub(twoCol, facts, "top", "bottom");
  g.G7 = sub(firstInput, formHeading, "top", "bottom");
  g.G9 = sub(submitBtn, firstInput, "top", "bottom"); // approximate: last input ≈ first input here; for a precise rhythm we'd need all inputs
  g.G11 = sub(trustCard, formCard, "top", "bottom");
  g.G12 = sub(slider, trustCard, "top", "bottom");
  g.G13 = stickyBar && stickyBar.height ? sub(stickyBar, trustCard, "top", "bottom") : null;

  // Horizontal gaps (desktop matters most)
  const viewportW = d.viewport.innerWidth;
  g.H1 = primary && primary.left !== undefined ? primary.left : null;
  g.H2 = primary && primary.right !== undefined ? viewportW - primary.right : null;
  g.H3 = primary && desktopThumb1 ? desktopThumb1.left! - primary.right! : null;
  g.H4 = desktopThumb1 && desktopThumb2 ? desktopThumb2.top! - desktopThumb1.bottom! : null;

  return g;
}

function sanityChecks(r: ViewportResult, gaps: Record<string, number | null>) {
  const issues: string[] = [];
  const vp = r.viewport;
  const isDesktop = vp.width >= 1024;
  const d = r.data;

  // S1 — vertical gaps out of band (8–80 px). Skip mobile-only gaps on
  // desktop and vice versa.
  for (const [k, val] of Object.entries(gaps)) {
    if (val === null) continue;
    if (!k.startsWith("G")) continue;
    if (k === "G3" && isDesktop) continue;
    if (k === "G13" && isDesktop) continue;
    if (val < 8 || val > 80) {
      // G6 + G11 + G12 can legitimately be larger (section padding around
      // 32–64 px is common). Widen tolerance for those.
      if ((k === "G6" || k === "G11" || k === "G12") && val <= 96) continue;
      issues.push(`S1: ${k} = ${val.toFixed(1)}px outside 8–80 expected band`);
    }
  }

  // S2 — desktop gutter symmetry
  if (isDesktop && gaps.H1 !== null && gaps.H2 !== null) {
    const delta = Math.abs(gaps.H1 - gaps.H2);
    if (delta > 4) issues.push(`S2: H1=${gaps.H1.toFixed(1)}px vs H2=${gaps.H2.toFixed(1)}px diff ${delta.toFixed(1)}px > 4`);
  }

  // S4 — G11 form→trust card 12–32 px
  if (gaps.G11 !== null && (gaps.G11 < 12 || gaps.G11 > 32)) {
    issues.push(`S4: G11=${gaps.G11.toFixed(1)}px outside 12–32 (form→trust card)`);
  }

  // S5 — G2 photo→facts 16–48 px (mobile uses strip→facts via G3)
  const G2orG3 = isDesktop ? gaps.G2 : gaps.G3 ?? gaps.G2;
  if (G2orG3 !== null && (G2orG3 < 16 || G2orG3 > 48)) {
    issues.push(`S5: photo→facts gap=${G2orG3.toFixed(1)}px outside 16–48`);
  }

  // S6 — G6 facts→two-col 24–64 px
  if (gaps.G6 !== null && (gaps.G6 < 24 || gaps.G6 > 64)) {
    issues.push(`S6: G6=${gaps.G6.toFixed(1)}px outside 24–64 (facts→description section)`);
  }

  // S7 — H3 photo→thumb-col equals H4 thumb-vert gap (desktop)
  if (isDesktop && gaps.H3 !== null && gaps.H4 !== null) {
    const delta = Math.abs(gaps.H3 - gaps.H4);
    if (delta > 2) issues.push(`S7: H3=${gaps.H3.toFixed(1)}px vs H4=${gaps.H4.toFixed(1)}px diff ${delta.toFixed(1)}px (should be ~equal)`);
  }

  // S8 — touch targets ≥ 44 px on mobile
  if (!isDesktop) {
    for (const p of d.badgePills) {
      if (p.rect && p.rect.height < 44) {
        issues.push(`S8: badge "${p.text}" height=${p.rect.height.toFixed(1)}px < 44 (touch target floor)`);
      }
    }
    if (d.submitBtn.rect && d.submitBtn.rect.height < 44) {
      issues.push(`S8: submit button height=${d.submitBtn.rect.height.toFixed(1)}px < 44`);
    }
    if (d.firstInput.rect && d.firstInput.rect.height < 44) {
      issues.push(`S8: first input height=${d.firstInput.rect.height.toFixed(1)}px < 44`);
    }
  }

  // S9 — hero aspect 1.30–1.36 (4:3 ±2%)
  const pp = d.primaryPhoto.button;
  if (pp && pp.height > 0) {
    const aspect = pp.width / pp.height;
    if (aspect < 1.3 || aspect > 1.36) {
      issues.push(`S9: hero aspect=${aspect.toFixed(3)} outside 1.30–1.36 (4:3 tolerance)`);
    }
  }

  // S10 — NEW + counter pills inside the photo, top offset ≥ 8 px
  if (pp && d.newPill) {
    const off = d.newPill.top - pp.top;
    if (off < 8) issues.push(`S10: NEW pill top offset=${off.toFixed(1)}px (≤8 from photo top)`);
  }
  if (pp && d.counterPill) {
    const off = d.counterPill.top - pp.top;
    if (off < 8) issues.push(`S10: counter pill top offset=${off.toFixed(1)}px (≤8 from photo top)`);
  }

  // S11 — sticky behavior (desktop)
  if (isDesktop) {
    const s = r.stickyTest as { stickyDeclared?: boolean; stuckAt?: number | null; releasedAt?: number | null; error?: string } | null;
    if (!s) issues.push("S11: sticky-scroll test did not run");
    else if (s.error) issues.push(`S11: sticky test error: ${s.error}`);
    else if (!s.stickyDeclared) issues.push("S11: aside position computed style ≠ sticky");
    else if (s.stuckAt === null || s.stuckAt === undefined) issues.push("S11: aside never reached sticky-pinned state during scroll");
  }

  // S12 — mobile thumb strip equal widths
  if (!isDesktop && d.mobileStripChildren.length > 1) {
    const ws = d.mobileStripChildren.map((c) => c.rect?.width || 0);
    const unique = Array.from(new Set(ws.map((w) => Math.round(w))));
    if (unique.length > 1) {
      issues.push(`S12: mobile strip thumbs have unequal widths: ${unique.join(", ")}px`);
    }
  }

  // S14 — facts band horizontal gap H7 (compute from adjacent facts items)
  if (d.factsItems.length >= 2) {
    const a = d.factsItems[0].rect, b = d.factsItems[1].rect;
    if (a && b) {
      const gap = b.left - a.right;
      if (gap < 8) issues.push(`S14: facts item gap=${gap.toFixed(1)}px < 8 (too tight)`);
    }
  }

  return issues;
}

interface ContrastResult { pair: string; ratio: number | null; threshold: number; pass: boolean }

function contrastChecks(r: ViewportResult): ContrastResult[] {
  const d = r.data;
  const pageBg = d.pageBody.computed?.["background-color"] || null;
  const formBg = d.formCard.computed?.["background-color"] || null;
  const aboutCardBg = "rgb(10, 22, 40)"; // #0a1628 (about card)

  function check(pair: string, fg: string | null | undefined, bg: string | null | undefined, threshold: number): ContrastResult {
    const ratio = contrast(fg, bg);
    return { pair, ratio, threshold, pass: ratio !== null && ratio >= threshold };
  }

  return [
    // Price text is "large" per WCAG (>= 24 px); threshold 3.0.
    check("price → pageBg", d.priceEl.computed?.color, pageBg, 3.0),
    check("address → pageBg", d.addressEl.computed?.color, pageBg, 4.5),
    check("factsRow → pageBg", d.factsRow.computed?.color, pageBg, 4.5),
    check("description → aboutCardBg", d.descriptionP.computed?.color, aboutCardBg, 4.5),
    check("form heading → formBg", d.formHeading.computed?.color, formBg, 4.5),
    check("first input label → formBg", d.firstInputLabel.computed?.color, formBg, 4.5),
    check("submit button text → submit bg", d.submitBtn.computed?.color, d.submitBtn.computed?.["background-color"], 4.5),
  ];
}

interface Verdict { verdict: "PASS" | "SOFT FAIL" | "HARD FAIL"; reasons: string[] }

function decideVerdict(r: ViewportResult, issues: string[], contrastRes: ContrastResult[]): Verdict {
  const reasons: string[] = [];

  // Hard-fail critical sanity rules
  const critical = issues.filter((i) => /^S(8|11|15):/.test(i));
  if (critical.length > 0) reasons.push(`${critical.length} critical sanity violation(s) (S8/S11/S15)`);

  // LCP must be the hero photo
  const perf = r.data.perf as { lcp?: number | null; lcpTag?: string | null; lcpAlt?: string | null } | undefined;
  const lcpIsHero =
    !!perf?.lcpTag &&
    perf.lcpTag.toLowerCase() === "img" &&
    typeof perf.lcpAlt === "string" &&
    /primary photo/i.test(perf.lcpAlt);
  if (perf && perf.lcp !== null && !lcpIsHero) {
    reasons.push(`LCP element is ${perf.lcpTag}/${perf.lcpAlt ?? "no-alt"}, not hero photo`);
  }
  if (!perf || perf.lcp === null) reasons.push("LCP not observed");

  // Contrast — any failure is hard
  const contrastFails = contrastRes.filter((c) => c.ratio !== null && !c.pass);
  if (contrastFails.length > 0) {
    reasons.push(`${contrastFails.length} contrast pair(s) below threshold`);
  }

  // Page errors and uncaught exceptions
  const errors = r.consoleMessages.filter((m) => m.type === "error" || m.type === "pageerror");
  if (errors.length > 0) reasons.push(`${errors.length} console error(s)`);

  // Lightbox interaction
  const lb = r.lightboxTest as { opened?: boolean; error?: string } | null;
  if (lb && lb.error) reasons.push(`lightbox CTA missing (${lb.error})`);
  if (lb && lb.opened === false && !lb.error) reasons.push("lightbox failed to open");

  if (reasons.length > 0) return { verdict: "HARD FAIL", reasons };

  // Soft-fail: minor S-issues (non-critical) up to 3
  const minor = issues.filter((i) => !/^S(8|11|15):/.test(i));
  if (minor.length > 0 && minor.length <= 3) {
    return { verdict: "SOFT FAIL", reasons: minor };
  }
  if (minor.length > 3) {
    return { verdict: "HARD FAIL", reasons: [`${minor.length} minor sanity violations`] };
  }

  return { verdict: "PASS", reasons: [] };
}

// ─── Markdown summary ──────────────────────────────────────────────────────

function fmt(n: number | null | undefined, suffix = ""): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${typeof n === "number" ? n.toFixed(1) : n}${suffix}`;
}

function toMarkdown(allResults: Array<ViewportResult & { gaps: Record<string, number | null>; issues: string[]; contrast: ContrastResult[]; verdict: Verdict }>) {
  const ts = new Date().toISOString();
  let md = `# Hero Pixel Audit — ${allResults[0]?.url || ""}\n\n_Generated: ${ts}_\n\n`;
  md += `## Verdict roll-up\n\n| Viewport | Verdict | LCP element | LCP ms | CLS | Issues |\n|---|---|---|---|---|---|\n`;
  for (const r of allResults) {
    const perf = r.data.perf as { lcp?: number | null; lcpTag?: string | null; lcpAlt?: string | null; cls?: number } | undefined;
    md += `| ${r.viewport.name}px | ${r.verdict.verdict} | ${perf?.lcpTag ?? "—"}${perf?.lcpAlt ? `[alt="${perf.lcpAlt}"]` : ""} | ${fmt(perf?.lcp)} | ${fmt(perf?.cls)} | ${r.issues.length} |\n`;
  }
  md += `\n---\n\n`;

  for (const r of allResults) {
    const d = r.data;
    const perf = d.perf as { lcp?: number | null; lcpTag?: string | null; lcpAlt?: string | null; cls?: number } | undefined;
    md += `## Viewport ${r.viewport.name}px (${r.viewport.width}×${r.viewport.height})\n\n`;

    md += `### Sections\n| Section | top | bottom | height |\n|---|---|---|---|\n`;
    md += `| Header | ${fmt(d.header?.top)} | ${fmt(d.header?.bottom)} | ${fmt(d.header?.height)} |\n`;
    md += `| Hero | ${fmt(d.heroSection?.top)} | ${fmt(d.heroSection?.bottom)} | ${fmt(d.heroSection?.height)} |\n`;
    md += `| Facts | ${fmt(d.factsSection?.top)} | ${fmt(d.factsSection?.bottom)} | ${fmt(d.factsSection?.height)} |\n`;
    md += `| Two-col | ${fmt(d.twoColSection?.top)} | ${fmt(d.twoColSection?.bottom)} | ${fmt(d.twoColSection?.height)} |\n`;
    md += `| Slider top | ${fmt(d.sliderSection?.top)} | — | — |\n\n`;

    md += `### Primary hero photo\n`;
    md += `- Bounds: top=${fmt(d.primaryPhoto.button?.top)} left=${fmt(d.primaryPhoto.button?.left)} width=${fmt(d.primaryPhoto.button?.width)} height=${fmt(d.primaryPhoto.button?.height)}\n`;
    md += `- aspect-ratio: ${d.primaryPhoto.button ? (d.primaryPhoto.button.width / d.primaryPhoto.button.height).toFixed(3) : "—"}\n`;
    md += `- fetchpriority=\`${d.primaryPhoto.fetchPriority ?? "(unset)"}\`  loading=\`${d.primaryPhoto.loading ?? "(unset)"}\`  decoding=\`${d.primaryPhoto.decoding ?? "(unset)"}\`\n`;
    md += `- img loaded: ${d.primaryPhoto.imgComplete ? "yes" : "no"}\n\n`;

    md += `### Vertical gaps\n| G | Description | Value |\n|---|---|---|\n`;
    md += `| G1 | Header bottom → primary photo top | ${fmt(r.gaps.G1, "px")} |\n`;
    md += `| G2 | Primary photo bottom → facts top | ${fmt(r.gaps.G2, "px")} |\n`;
    md += `| G3 | Mobile thumb strip bottom → facts top | ${fmt(r.gaps.G3, "px")} |\n`;
    md += `| G4 | Price/address bottom → facts row top | ${fmt(r.gaps.G4, "px")} |\n`;
    md += `| G5 | Facts row bottom → badges row top | ${fmt(r.gaps.G5, "px")} |\n`;
    md += `| G6 | Facts bottom → two-col section top | ${fmt(r.gaps.G6, "px")} |\n`;
    md += `| G7 | Form heading bottom → first input top | ${fmt(r.gaps.G7, "px")} |\n`;
    md += `| G11 | Form card bottom → trust card top | ${fmt(r.gaps.G11, "px")} |\n`;
    md += `| G12 | Trust card bottom → slider top | ${fmt(r.gaps.G12, "px")} |\n`;
    md += `| G13 | Trust card bottom → sticky mobile bar top | ${fmt(r.gaps.G13, "px")} |\n\n`;

    md += `### Horizontal gaps\n| H | Description | Value |\n|---|---|---|\n`;
    md += `| H1 | Page left → primary photo left | ${fmt(r.gaps.H1, "px")} |\n`;
    md += `| H2 | Primary photo right → page right | ${fmt(r.gaps.H2, "px")} |\n`;
    md += `| H3 | Primary photo right → desktop thumb1 left | ${fmt(r.gaps.H3, "px")} |\n`;
    md += `| H4 | Desktop thumb1 bottom → thumb2 top | ${fmt(r.gaps.H4, "px")} |\n\n`;

    md += `### Typography (computed)\n| Element | font-size | line-height | font-family | color |\n|---|---|---|---|---|\n`;
    function trow(label: string, c: Record<string, string> | null | undefined) {
      if (!c) return `| ${label} | — | — | — | — |\n`;
      return `| ${label} | ${c["font-size"]} | ${c["line-height"]} | ${(c["font-family"] || "").slice(0, 50)} | ${c.color} |\n`;
    }
    md += trow("Price", d.priceEl.computed);
    md += trow("Address", d.addressEl.computed);
    md += trow("Form heading", d.formHeading.computed);
    md += trow("First input label", d.firstInputLabel.computed);
    md += trow("Submit button", d.submitBtn.computed);
    md += trow("Facts row", d.factsRow.computed);
    md += trow("Description body", d.descriptionP.computed);
    md += `\n`;

    md += `### Contrast (WCAG)\n| Pair | Ratio | Threshold | Pass |\n|---|---|---|---|\n`;
    for (const c of r.contrast) {
      md += `| ${c.pair} | ${c.ratio !== null ? c.ratio.toFixed(2) + ":1" : "—"} | ${c.threshold}:1 | ${c.pass ? "✓" : "✗"} |\n`;
    }
    md += `\n`;

    md += `### Performance\n`;
    md += `- LCP element: \`${perf?.lcpTag ?? "—"}\` alt=\`${perf?.lcpAlt ?? "—"}\` id=\`${perf?.lcpId ?? "—"}\`\n`;
    md += `- LCP time: ${fmt(perf?.lcp, " ms")}\n`;
    md += `- CLS: ${fmt(perf?.cls)}\n`;
    md += `- Resource count: ${r.resources.count}\n`;
    md += `- Image bytes: ${(r.resources.imageBytes / 1024).toFixed(1)} KB\n`;
    md += `- Total bytes: ${(r.resources.totalBytes / 1024).toFixed(1)} KB\n`;
    md += `- First 5 images (by start time):\n`;
    for (const im of r.resources.firstFiveImages) {
      md += `  - \`${im.name}\` ${(im.bytes / 1024).toFixed(1)} KB @ ${im.startMs}ms\n`;
    }
    md += `\n`;

    md += `### Interactions\n`;
    const lb = r.lightboxTest as { opened?: boolean; openMs?: number; ctaSource?: string; ctaLabel?: string; error?: string } | null;
    md += `- Lightbox CTA source: ${lb?.ctaSource ?? "—"} (\`${lb?.ctaLabel ?? "—"}\`)\n`;
    md += `- Lightbox opened: ${lb?.opened ? `yes (${fmt(lb.openMs, " ms")})` : `no${lb?.error ? ` — ${lb.error}` : ""}`}\n`;
    const st = r.stickyTest as { stickyDeclared?: boolean; stuckAt?: number | null; releasedAt?: number | null; error?: string } | null;
    if (st) {
      md += `- Sticky declared (position:sticky): ${st.stickyDeclared ? "yes" : "no"}\n`;
      md += `- Stuck at scrollY: ${fmt(st.stuckAt, "px")}\n`;
      md += `- Released at scrollY: ${fmt(st.releasedAt, "px")}\n`;
      if (st.error) md += `- Sticky test error: ${st.error}\n`;
    } else if (r.viewport.width >= 1024) {
      md += `- Sticky test: not run\n`;
    } else {
      md += `- Sticky test: skipped (mobile)\n`;
    }
    md += `\n`;

    md += `### Tab order (first 8 stops)\n`;
    for (const t of r.tabOrder) md += `- ${t}\n`;
    md += `\n`;

    md += `### Form input attrs (first input)\n`;
    const fa = d.firstInput.attrs;
    if (fa) {
      md += `- type=\`${fa.type}\`  inputMode=\`${fa.inputMode ?? "(none)"}\`  autocomplete=\`${fa.autocomplete}\`  name=\`${fa.name ?? "(none)"}\`  pattern=\`${fa.pattern ?? "(none)"}\`  required=${fa.required}\n\n`;
    } else {
      md += `- _form first input not found_\n\n`;
    }

    md += `### Issues flagged\n`;
    if (r.issues.length === 0) md += `_(none)_\n\n`;
    else {
      for (const i of r.issues) md += `- ${i}\n`;
      md += `\n`;
    }

    md += `**Console errors**: ${r.consoleMessages.filter((m) => m.type === "error" || m.type === "pageerror").length}\n`;
    md += `**Verdict**: ${r.verdict.verdict}${r.verdict.reasons.length ? ` — ${r.verdict.reasons.join("; ")}` : ""}\n\n---\n\n`;
  }

  return md;
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();
  await ensureDir(OUTPUT_DIR);

  console.log(`Target URL: ${args.url}`);
  console.log(`Headed: ${args.headed ? "yes" : "no (headless)"}`);
  console.log(`Output: ${OUTPUT_DIR}\n`);

  const browser = await puppeteer.launch({
    headless: !args.headed,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const targets =
    args.viewport === "all" ? VIEWPORTS : VIEWPORTS.filter((v) => v.name === args.viewport);

  type Enriched = ViewportResult & {
    gaps: Record<string, number | null>;
    issues: string[];
    contrast: ContrastResult[];
    verdict: Verdict;
  };
  const all: Enriched[] = [];
  const stem = slug(args.url);

  for (const vp of targets) {
    console.log(`── Auditing ${vp.name}px (${vp.width}×${vp.height}) ──`);
    const r = await runViewport(browser, args.url, vp);
    const gaps = computeGaps(r);
    const issues = sanityChecks(r, gaps);
    const ctr = contrastChecks(r);
    const verdict = decideVerdict(r, issues, ctr);
    const enriched: Enriched = { ...r, gaps, issues, contrast: ctr, verdict };

    const jsonPath = path.join(OUTPUT_DIR, `${stem}-${vp.name}.json`);
    await fs.writeFile(jsonPath, JSON.stringify(enriched, null, 2));

    console.log(`  Verdict: ${verdict.verdict}${verdict.reasons.length ? "  — " + verdict.reasons.join("; ") : ""}`);
    const top3 = issues.slice(0, 3);
    if (top3.length > 0) {
      console.log(`  Top issues:`);
      for (const t of top3) console.log(`    - ${t}`);
    }
    const perf = r.data.perf as { lcp?: number | null; lcpTag?: string | null; lcpAlt?: string | null } | undefined;
    console.log(`  LCP: ${perf?.lcpTag ?? "—"} alt="${perf?.lcpAlt ?? "—"}" @ ${perf?.lcp?.toFixed(0) ?? "—"} ms`);
    console.log(`  JSON: ${jsonPath}\n`);

    all.push(enriched);
  }

  await browser.close();

  const md = toMarkdown(all);
  const mdPath = path.join(OUTPUT_DIR, `${stem}-summary.md`);
  await fs.writeFile(mdPath, md);
  console.log(`Markdown summary: ${mdPath}`);

  const verdicts = all.map((r) => r.verdict.verdict);
  if (verdicts.some((v) => v === "HARD FAIL")) process.exit(2);
  if (verdicts.some((v) => v === "SOFT FAIL")) process.exit(1);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
