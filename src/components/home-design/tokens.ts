// src/components/home-design/tokens.ts
// MH-013: the colours of the homepage design preview, three orange, navy and white palettes and
// nothing else. Every colour on /design-preview/home comes from this file: the page writes the
// chosen palette as CSS variables (--b-*) on its root, and home-design.css and brand-preview.css
// read only those variables, so the nav, the hero, the sections and the footer change together.
// scratchpad/mh013/contrast.ts measures every text pair below from this same file.
//
// The rules the palettes keep:
//   - navy and ink carry the reading; orange is an accent, a thin rule, a mark or a button fill;
//   - `lead` is the lead-capture colour and is painted on lead buttons only (the scarcity rule
//     #00ff80 follows on the live site); `accent` is a different orange and never fills a button;
//   - bright orange is never text on a light ground: `accentText` is the dark orange that passes;
//   - no green, anywhere.

export type PaletteKey = "1" | "2" | "3";

export type Palette = {
  key: PaletteKey;
  name: string;
  idea: string;
  page: string;
  pageAlt: string;
  paper: string;
  ink: string;
  muted: string;
  line: string;
  navy: string;
  navyDeep: string;
  navySoft: string;
  navyRaised: string;
  onNavy: string;
  onNavyMuted: string;
  accent: string;
  accentText: string;
  accentOnNavy: string;
  accentTint: string;
  lead: string;
  leadHover: string;
  leadText: string;
};

export const PALETTES: Record<PaletteKey, Palette> = {
  "1": {
    key: "1",
    name: "Harbour",
    idea: "A classic marine navy with burnt orange on warm ivory paper: the look of a long-established firm.",
    page: "#f8f5f0",
    pageAlt: "#f1ece4",
    paper: "#ffffff",
    ink: "#14213a",
    muted: "#4c566a",
    line: "#e3ddd2",
    navy: "#14294a",
    navyDeep: "#0c1b33",
    navySoft: "#1d3760",
    navyRaised: "#26436f",
    onNavy: "#ffffff",
    onNavyMuted: "#c3cddd",
    accent: "#d8642e",
    accentText: "#a6461b",
    accentOnNavy: "#f2a77c",
    accentTint: "#f8e7dc",
    lead: "#f47b30",
    leadHover: "#f68b48",
    leadText: "#14294a",
  },
  "2": {
    key: "2",
    name: "Midnight",
    idea: "Near-black navy with saffron on a cool off-white: quieter, closer to a private bank.",
    page: "#f4f5f7",
    pageAlt: "#eceef2",
    paper: "#ffffff",
    ink: "#0f1726",
    muted: "#4a5263",
    line: "#dde1e7",
    navy: "#0c1a2e",
    navyDeep: "#070f1c",
    navySoft: "#16273f",
    navyRaised: "#203553",
    onNavy: "#ffffff",
    onNavyMuted: "#bcc5d4",
    accent: "#dd7a22",
    accentText: "#9a500f",
    accentOnNavy: "#f5b56f",
    accentTint: "#fbeedd",
    lead: "#f5952f",
    leadHover: "#f7a54f",
    leadText: "#0c1a2e",
  },
  "3": {
    key: "3",
    name: "Slate",
    idea: "A lighter slate navy with coral orange on stone: the most daylight of the three.",
    page: "#f6f5f2",
    pageAlt: "#eeece7",
    paper: "#ffffff",
    ink: "#1b2535",
    muted: "#4f596a",
    line: "#e2e0da",
    navy: "#203b60",
    navyDeep: "#162b48",
    navySoft: "#2b4a74",
    navyRaised: "#355885",
    onNavy: "#ffffff",
    onNavyMuted: "#d3dcea",
    accent: "#e2603d",
    accentText: "#ad401d",
    accentOnNavy: "#ffb79e",
    accentTint: "#fbe6dd",
    lead: "#ff7a4d",
    leadHover: "#ff8c64",
    leadText: "#162b48",
  },
};

const KEBAB: Record<Exclude<keyof Palette, "key" | "name" | "idea">, string> = {
  page: "page",
  pageAlt: "page-alt",
  paper: "paper",
  ink: "ink",
  muted: "muted",
  line: "line",
  navy: "navy",
  navyDeep: "navy-deep",
  navySoft: "navy-soft",
  navyRaised: "navy-raised",
  onNavy: "on-navy",
  onNavyMuted: "on-navy-muted",
  accent: "accent",
  accentText: "accent-text",
  accentOnNavy: "accent-on-navy",
  accentTint: "accent-tint",
  lead: "lead",
  leadHover: "lead-hover",
  leadText: "lead-text",
};

/** The palette as CSS variables, written on the preview's root element. */
export function paletteVars(p: Palette): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(KEBAB)) out[`--b-${v}`] = p[k as keyof typeof KEBAB];
  return out;
}

export type TokenKey = keyof typeof KEBAB;

/** Every text colour the preview paints, on every ground it paints it on. contrast.ts walks this. */
export const TEXT_PAIRS: [string, TokenKey, TokenKey][] = [
  ["body ink on the page", "ink", "page"],
  ["body ink on a card", "ink", "paper"],
  ["body ink on the alternate band", "ink", "pageAlt"],
  ["secondary text on the page", "muted", "page"],
  ["secondary text on a card", "muted", "paper"],
  ["secondary text on the alternate band", "muted", "pageAlt"],
  ["secondary text on the orange tint", "muted", "accentTint"],
  ["navy headings and links on the page", "navy", "page"],
  ["navy headings and links on a card", "navy", "paper"],
  ["navy on the alternate band", "navy", "pageAlt"],
  ["dark orange labels and arrows on the page", "accentText", "page"],
  ["dark orange labels and arrows on a card", "accentText", "paper"],
  ["the planned tag (dark orange on its tint)", "accentText", "accentTint"],
  ["white on navy (header, Selling door, band, navy buttons)", "onNavy", "navy"],
  ["white on deep navy (strip, footer)", "onNavy", "navyDeep"],
  ["white on soft navy (nav buttons, panels)", "onNavy", "navySoft"],
  ["white on raised navy (hover)", "onNavy", "navyRaised"],
  ["soft text on navy", "onNavyMuted", "navy"],
  ["soft text on deep navy", "onNavyMuted", "navyDeep"],
  ["soft text on soft navy", "onNavyMuted", "navySoft"],
  ["light orange marks on navy", "accentOnNavy", "navy"],
  ["light orange marks on deep navy", "accentOnNavy", "navyDeep"],
  ["light orange marks on soft navy", "accentOnNavy", "navySoft"],
  ["lead button label", "leadText", "lead"],
  ["lead button label, hovered", "leadText", "leadHover"],
];

export const WORDMARKS = ["script", "serif"] as const;
export type Wordmark = (typeof WORDMARKS)[number];
