// src/components/home/HeroMap.tsx
//
// Stylized inline SVG sketch of Milton for the hero background (2026-07-21,
// Aamir-directed; cartography pass same day). Deliberately simplified, NOT
// cartographically exact: the recognizable road skeleton, the Escarpment
// edge, a rough town boundary, faint neighbourhood labels, and six outline
// teardrop pins at real landmarks. Line work + labels only - no area fills,
// no water/parks. One dull faded-yellow tone.
//
// Layering: .mh-map carries the base 0.12 opacity; .mh-pins sits at 0.25 so
// pins read as points of interest above the line work (home-theme.css). The
// #mhMask mask gives the map an edge vignette (dissolves before the hero
// boundary) plus a soft radial clearing under the central headline/card
// column; pins are unmasked and placed outside that clearing. Zero JS, zero
// deps, no external fetch; aria-hidden + pointer-events:none.

export function HeroMap() {
  return (
    <div className="m-heromap" aria-hidden="true">
      <svg
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        <defs>
          {/* edge vignette: full strength mid-band, dissolved at the rim */}
          <radialGradient
            id="mhEdge"
            gradientUnits="userSpaceOnUse"
            cx="600"
            cy="400"
            r="640"
            gradientTransform="translate(600 400) scale(1 0.5) translate(-600 -400)"
          >
            <stop offset="0.6" stopColor="#fff" />
            <stop offset="1" stopColor="#000" />
          </radialGradient>
          {/* headline clearing: drops the map to ~45% of itself mid-column */}
          <radialGradient
            id="mhClear"
            gradientUnits="userSpaceOnUse"
            cx="600"
            cy="430"
            r="280"
            gradientTransform="translate(600 430) scale(1 1.18) translate(-600 -430)"
          >
            <stop offset="0" stopColor="#000" stopOpacity="0.55" />
            <stop offset="0.6" stopColor="#000" stopOpacity="0.38" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <mask id="mhMask" maskUnits="userSpaceOnUse" x="0" y="0" width="1200" height="800">
            <rect width="1200" height="800" fill="url(#mhEdge)" />
            <ellipse cx="600" cy="430" rx="280" ry="330" fill="url(#mhClear)" />
          </mask>
          {/* outline teardrop pin, tip at local (0,0), ~14 units tall */}
          <g id="mhPinShape">
            <path d="M0 0 C-3.8 -5.2 -5 -7 -5 -9 A5 5 0 1 1 5 -9 C5 -7 3.8 -5.2 0 0 Z" />
            <circle cx="0" cy="-9.2" r="1.7" />
          </g>
        </defs>

        <g className="mh-map" mask="url(#mhMask)">
          {/* whisper graticule for the engineer's-drawing feel */}
          <path
            className="mh-grid"
            d="M200 0V800M400 0V800M600 0V800M800 0V800M1000 0V800M0 150H1200M0 350H1200M0 550H1200M0 750H1200"
          />

          {/* town boundary - fine dashed, quieter than the roads */}
          <path
            className="mh-boundary"
            d="M160,100 L1120,68 L1162,690 L205,752 Z"
          />

          {/* Niagara Escarpment edge - twin fine dashed wavy strokes, west side */}
          <path
            className="mh-esc"
            d="M212,118 C 182,220 220,320 190,420 C 168,520 208,620 178,732"
          />
          <path
            className="mh-esc mh-esc2"
            d="M236,122 C 206,222 242,322 214,422 C 192,522 230,622 202,728"
          />

          {/* highways - heaviest weight */}
          <path className="mh-hwy" d="M122,192 C 400,152 800,122 1158,110" />
          <path className="mh-hwy" d="M982,62 C 1040,92 1100,94 1158,152" />

          {/* arterials - medium weight */}
          <path className="mh-road" d="M262,262 C 500,246 800,226 1140,206" />
          <path className="mh-road" d="M232,432 C 450,416 600,382 780,371 C 900,363 1000,360 1140,351" />
          <path className="mh-road" d="M202,562 C 500,541 900,506 1155,481" />
          <path className="mh-road" d="M232,702 C 550,676 900,641 1150,616" />
          <path className="mh-road" d="M332,242 C 326,400 332,550 321,722" />
          <path className="mh-road" d="M661,236 C 666,380 656,520 666,702" />
          <path className="mh-road" d="M901,142 C 941,260 901,420 931,560 C 941,610 931,652 941,692" />

          {/* road labels - Title Case, rotated along their road */}
          <text className="mh-rlabel" x="948" y="100" transform="rotate(-4 948 100)">401</text>
          <text className="mh-rlabel" x="1092" y="88" transform="rotate(26 1092 88)">407</text>
          <text className="mh-rlabel" x="998" y="198" transform="rotate(-3.5 998 198)">Steeles Ave</text>
          <text className="mh-rlabel" x="1008" y="344" transform="rotate(-3 1008 344)">Main St</text>
          <text className="mh-rlabel" x="1012" y="474" transform="rotate(-5.5 1012 474)">Derry Rd</text>
          <text className="mh-rlabel" x="994" y="608" transform="rotate(-5.5 994 608)">Britannia Rd</text>
          <text className="mh-rlabel" x="312" y="648" transform="rotate(-87 312 648)">Bronte St</text>
          <text className="mh-rlabel" x="680" y="648" transform="rotate(-88 680 648)">Thompson Rd</text>
          <text className="mh-rlabel" x="958" y="312" transform="rotate(-83 958 312)">James Snow Pkwy</text>
          <text className="mh-rlabel" x="176" y="360" transform="rotate(-80 176 360)">Niagara Escarpment</text>

          {/* neighbourhood labels - letter-spaced caps, roughly placed */}
          <text className="mh-nlabel" x="258" y="182">Milton Heights</text>
          <text className="mh-nlabel" x="402" y="322">Scott</text>
          <text className="mh-nlabel" x="562" y="330">Timberlea</text>
          <text className="mh-nlabel" x="762" y="300">Dempsey</text>
          <text className="mh-nlabel" x="500" y="458">Old Milton</text>
          <text className="mh-nlabel" x="392" y="502">Bronte Meadows</text>
          <text className="mh-nlabel" x="790" y="432">Clarke</text>
          <text className="mh-nlabel" x="948" y="472">Beaty</text>
          <text className="mh-nlabel" x="388" y="622">Harrison</text>
          <text className="mh-nlabel" x="562" y="642">Willmott</text>
          <text className="mh-nlabel" x="760" y="726">Ford</text>
        </g>

        {/* landmark pins - slightly brighter than the map, outside the
            headline clearing (open flanks only) */}
        <g className="mh-pins">
          <use href="#mhPinShape" transform="translate(186 268)" />
          <text className="mh-plabel" x="198" y="252">Kelso</text>

          <use href="#mhPinShape" transform="translate(300 430)" />
          <text className="mh-plabel" x="252" y="448">Downtown Milton</text>

          <use href="#mhPinShape" transform="translate(310 560)" />
          <text className="mh-plabel" x="246" y="578">Milton District Hospital</text>

          <use href="#mhPinShape" transform="translate(905 330)" />
          <text className="mh-plabel" x="895" y="348" textAnchor="end">Milton GO Station</text>

          <use href="#mhPinShape" transform="translate(885 505)" />
          <text className="mh-plabel" x="875" y="523" textAnchor="end">Milton Sports Centre</text>

          <use href="#mhPinShape" transform="translate(1060 140)" />
          <text className="mh-plabel" x="1050" y="158" textAnchor="end">Toronto Premium Outlets</text>
        </g>
      </svg>
    </div>
  );
}
