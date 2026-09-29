// src/components/street-design/palettes.ts
// MH-011: the three colour directions for the street-page design preview. Every direction keeps
// the brand greens (forest #073126, accent #017848, #00ff80 on lead-capture buttons only) and
// adds one supporting hue, in three strengths: `support` for text and marks on light grounds,
// `supportTint` as a quiet ground, `supportOnDark` for marks on forest. The page reads these as
// CSS variables, and scratchpad/mh011/contrast.ts measures every text pair from this same file.

export type PaletteKey = "a" | "b" | "c";

export type Palette = {
  key: PaletteKey;
  name: string;
  idea: string;
  bg: string;
  paper: string;
  ink: string;
  muted: string;
  line: string;
  support: string;
  supportTint: string;
  supportOnDark: string;
};

export const BRAND = {
  forest: "#073126",
  forestSoft: "#0d3f31",
  accent: "#017848",
  cta: "#00ff80",
  white: "#ffffff",
  onForestMuted: "#c3d6cd",
};

export const PALETTES: Record<PaletteKey, Palette> = {
  a: {
    key: "a",
    name: "Clay",
    idea: "Cream paper with a brick-clay accent, the colour of the Milton escarpment's red shale and the brick on many Milton houses.",
    bg: "#f6f4ef",
    paper: "#ffffff",
    ink: "#1c2621",
    muted: "#535c57",
    line: "#dcd8cf",
    support: "#a3401c",
    supportTint: "#f6e6dc",
    supportOnDark: "#f4a582",
  },
  b: {
    key: "b",
    name: "Lake",
    idea: "A cooler paper with a lake-slate blue, for a page that reads like a survey document.",
    bg: "#f2f5f4",
    paper: "#ffffff",
    ink: "#15231e",
    muted: "#505d58",
    line: "#d6dedb",
    support: "#275a86",
    supportTint: "#e1ecf5",
    supportOnDark: "#9cc8ef",
  },
  c: {
    key: "c",
    name: "Harvest",
    idea: "Warm wheat paper with an ochre accent, the fields that still ring the town.",
    bg: "#f8f5ec",
    paper: "#ffffff",
    ink: "#1d2520",
    muted: "#555a51",
    line: "#e0d9c6",
    support: "#855700",
    supportTint: "#f5e8c8",
    supportOnDark: "#f2c65a",
  },
};

export function paletteVars(p: Palette): Record<string, string> {
  return {
    "--sd-forest": BRAND.forest,
    "--sd-forest-soft": BRAND.forestSoft,
    "--sd-accent": BRAND.accent,
    "--sd-cta": BRAND.cta,
    "--sd-on-forest": BRAND.white,
    "--sd-on-forest-muted": BRAND.onForestMuted,
    "--sd-bg": p.bg,
    "--sd-paper": p.paper,
    "--sd-ink": p.ink,
    "--sd-muted": p.muted,
    "--sd-line": p.line,
    "--sd-support": p.support,
    "--sd-support-tint": p.supportTint,
    "--sd-support-on-dark": p.supportOnDark,
  };
}
