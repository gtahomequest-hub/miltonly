// src/components/home-design/tokens.ts
// MH-012: the colours of the homepage hero design preview. They are MH-011's brand greens and its
// palette A, Clay (the pick of the street design at f5b3bab), so the homepage and the street page
// read as one site. #00ff80 is painted on lead-capture buttons only. The page reads these as CSS
// variables, and scratchpad/mh012/contrast.ts measures every text pair from this same file.

export const HD = {
  forest: "#073126",
  forestSoft: "#0d3f31",
  accent: "#017848",
  cta: "#00ff80",
  white: "#ffffff",
  onForestMuted: "#c3d6cd",
  bg: "#f6f4ef",
  paper: "#ffffff",
  ink: "#1c2621",
  muted: "#535c57",
  line: "#dcd8cf",
  support: "#a3401c",
  supportTint: "#f6e6dc",
  supportOnDark: "#f4a582",
} as const;

export function hdVars(): Record<string, string> {
  return {
    "--hd-forest": HD.forest,
    "--hd-forest-soft": HD.forestSoft,
    "--hd-accent": HD.accent,
    "--hd-cta": HD.cta,
    "--hd-on-forest": HD.white,
    "--hd-on-forest-muted": HD.onForestMuted,
    "--hd-bg": HD.bg,
    "--hd-paper": HD.paper,
    "--hd-ink": HD.ink,
    "--hd-muted": HD.muted,
    "--hd-line": HD.line,
    "--hd-support": HD.support,
    "--hd-support-tint": HD.supportTint,
    "--hd-support-on-dark": HD.supportOnDark,
  };
}

/** Every text colour the hero paints, on every ground it paints it on. contrast.ts walks this. */
export const TEXT_PAIRS: [string, keyof typeof HD, keyof typeof HD][] = [
  ["H1 and side headings on forest", "white", "forest"],
  ["H1 tail on forest", "supportOnDark", "forest"],
  ["soft text and B's buyer links on forest", "onForestMuted", "forest"],
  ["soft text on forest soft (road, tabs, B's buyer rows)", "onForestMuted", "forestSoft"],
  ["white on forest soft", "white", "forestSoft"],
  ["clay marks on forest soft", "supportOnDark", "forestSoft"],
  ["CTA label on #00ff80", "forest", "cta"],
  ["body ink on paper", "ink", "paper"],
  ["body ink on cream", "ink", "bg"],
  ["muted on paper", "muted", "paper"],
  ["muted on cream", "muted", "bg"],
  ["accent (every link on a light ground) on paper", "accent", "paper"],
  ["accent on cream", "accent", "bg"],
  ["clay (seller marks, the planned tag) on paper", "support", "paper"],
  ["clay on cream", "support", "bg"],
  ["clay on clay tint (planned tag)", "support", "supportTint"],
  ["muted on clay tint", "muted", "supportTint"],
  ["forest on paper", "forest", "paper"],
  ["forest on cream", "forest", "bg"],
  ["white on accent", "white", "accent"],
];
