// src/components/home/HeroMap.tsx
//
// Stylized inline SVG sketch of Milton for the hero background (2026-07-21,
// Aamir-directed; cartography pass + center-exclusion/data-array pass same
// day). Deliberately simplified, NOT cartographically exact: the
// recognizable road skeleton, the Escarpment edge, a rough town boundary,
// and a single MAP_LOCATIONS data array of neighbourhood / landmark / road
// labels. Line work + labels + outline teardrop pins only - no area fills,
// no water/parks. One dull faded-yellow tone (#d4c05a); signal green is
// reserved for interactive elements and never appears here.
//
// Center exclusion: home-theme.css applies a radial-gradient CSS mask to
// the WHOLE .m-heromap container, fading the entire layer (lines, labels,
// pins) to zero behind the H1 / stat row / search card and leaving edges at
// full presence. Because of that, locations are deliberately edge-biased:
// central placements would be invisible. Geographic accuracy is therefore
// approximate-by-design - each label keeps its true compass bearing from
// the town core but is pushed outward into the visible ring.
//
// Layers inside the SVG: .mh-map = geometry only, opacity 0.12, with the
// #mhMask edge vignette so line work still dissolves before the hero rim;
// .mh-labels = all text at per-type opacities (neighbourhood 0.2, landmark
// 0.18, road 0.12), unmasked in-SVG; .mh-pins = teardrop pins (tip at
// local (0,0), translate() places the tip) breathing 0.22 -> 0.08 on
// staggered inline animation-delays (static under prefers-reduced-motion).
// Zero JS, zero deps, no external fetch; aria-hidden + pointer-events:none.

type MapLocationType = 'neighbourhood' | 'landmark' | 'road';

interface MapLocation {
  name: string;
  x: number;
  y: number;
  type: MapLocationType;
  pinned: boolean;
  /** road labels rotate to run along their drawn road */
  angle?: number;
}

// Coordinates are viewBox units (0-1200 x 0-800), placed relative to the
// DRAWN road skeleton below, edge-biased per the center mask.
const MAP_LOCATIONS: MapLocation[] = [
  // roads - rotated text, no pin
  { name: '401', x: 948, y: 100, type: 'road', pinned: false, angle: -4 },
  { name: '407', x: 1092, y: 88, type: 'road', pinned: false, angle: 26 },
  { name: 'Steeles Ave', x: 998, y: 198, type: 'road', pinned: false, angle: -3.5 },
  { name: 'Main St', x: 1008, y: 344, type: 'road', pinned: false, angle: -3 },
  { name: 'Derry Rd', x: 1012, y: 474, type: 'road', pinned: false, angle: -5.5 },
  { name: 'Britannia Rd', x: 994, y: 608, type: 'road', pinned: false, angle: -5.5 },
  { name: 'Bronte St', x: 312, y: 648, type: 'road', pinned: false, angle: -87 },
  { name: 'Ontario St', x: 482, y: 758, type: 'road', pinned: false, angle: -88 },
  { name: 'Thompson Rd', x: 672, y: 745, type: 'road', pinned: false, angle: -88 },
  { name: 'James Snow Pkwy', x: 958, y: 312, type: 'road', pinned: false, angle: -83 },
  { name: 'Niagara Escarpment', x: 176, y: 360, type: 'road', pinned: false, angle: -80 },

  // neighbourhoods - letter-spaced caps, no pin
  { name: 'Milton Heights', x: 258, y: 182, type: 'neighbourhood', pinned: false },
  { name: 'Mountain View', x: 310, y: 130, type: 'neighbourhood', pinned: false },
  { name: 'Scott', x: 250, y: 218, type: 'neighbourhood', pinned: false },
  { name: 'Dorset Park', x: 350, y: 98, type: 'neighbourhood', pinned: false },
  { name: 'Timberlea', x: 800, y: 180, type: 'neighbourhood', pinned: false },
  { name: 'Dempsey', x: 880, y: 205, type: 'neighbourhood', pinned: false },
  { name: 'Clarke', x: 1010, y: 415, type: 'neighbourhood', pinned: false },
  { name: 'Beaty', x: 960, y: 500, type: 'neighbourhood', pinned: false },
  { name: 'Walker', x: 1090, y: 520, type: 'neighbourhood', pinned: false },
  { name: 'Cobban', x: 1075, y: 615, type: 'neighbourhood', pinned: false },
  { name: 'Bowes', x: 1000, y: 700, type: 'neighbourhood', pinned: false },
  { name: 'Coates', x: 845, y: 678, type: 'neighbourhood', pinned: false },
  { name: 'Ford', x: 760, y: 726, type: 'neighbourhood', pinned: false },
  { name: 'Willmott', x: 560, y: 735, type: 'neighbourhood', pinned: false },
  { name: 'Harrison', x: 345, y: 655, type: 'neighbourhood', pinned: false },
  { name: 'Old Milton', x: 368, y: 738, type: 'neighbourhood', pinned: false },
  { name: 'Bronte Meadows', x: 270, y: 505, type: 'neighbourhood', pinned: false },

  // landmarks - pinned teardrops, label rides the tip at +(9,13)
  { name: 'Country Heritage Park', x: 150, y: 180, type: 'landmark', pinned: true },
  { name: 'Kelso Conservation Area', x: 196, y: 258, type: 'landmark', pinned: true },
  { name: 'Mill Pond', x: 365, y: 135, type: 'landmark', pinned: true },
  { name: 'Rattlesnake Point', x: 180, y: 560, type: 'landmark', pinned: true },
  { name: 'Downtown Milton', x: 255, y: 618, type: 'landmark', pinned: true },
  { name: 'Milton District Hospital', x: 330, y: 690, type: 'landmark', pinned: true },
  { name: 'Milton Mall', x: 1105, y: 255, type: 'landmark', pinned: true },
  { name: 'Milton GO Station', x: 1060, y: 367, type: 'landmark', pinned: true },
  { name: 'Milton Sports Centre', x: 990, y: 560, type: 'landmark', pinned: true },
];

// Outline teardrop, tip at local (0,0), ~14 units tall.
const PIN_PATH =
  'M0 0 C-3.8 -5.2 -5 -7 -5 -9 A5 5 0 1 1 5 -9 C5 -7 3.8 -5.2 0 0 Z';

const ROADS = MAP_LOCATIONS.filter((l) => l.type === 'road');
const NEIGHBOURHOODS = MAP_LOCATIONS.filter((l) => l.type === 'neighbourhood');
const LANDMARKS = MAP_LOCATIONS.filter((l) => l.type === 'landmark');

export function HeroMap() {
  return (
    <div className="m-heromap" aria-hidden="true">
      <svg
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        <defs>
          {/* edge vignette for the line work: full strength mid-band,
              dissolved at the rim */}
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
          <mask id="mhMask" maskUnits="userSpaceOnUse" x="0" y="0" width="1200" height="800">
            <rect width="1200" height="800" fill="url(#mhEdge)" />
          </mask>
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
          <path className="mh-road" d="M492,236 C 488,360 494,470 486,760" />
          <path className="mh-road" d="M661,236 C 666,380 656,520 666,702" />
          <path className="mh-road" d="M901,142 C 941,260 901,420 931,560 C 941,610 931,652 941,692" />
        </g>

        <g className="mh-labels">
          {ROADS.map((l) => (
            <text
              key={l.name}
              className="mh-rlabel"
              x={l.x}
              y={l.y}
              transform={`rotate(${l.angle ?? 0} ${l.x} ${l.y})`}
            >
              {l.name}
            </text>
          ))}
          {NEIGHBOURHOODS.map((l) => (
            <text key={l.name} className="mh-nlabel" x={l.x} y={l.y}>
              {l.name}
            </text>
          ))}
          {LANDMARKS.map((l) => (
            <text key={l.name} className="mh-plabel" x={l.x + 9} y={l.y + 13}>
              {l.name}
            </text>
          ))}
        </g>

        <g className="mh-pins">
          {LANDMARKS.filter((l) => l.pinned).map((l, i) => (
            <g
              key={l.name}
              className="mh-pin"
              transform={`translate(${l.x} ${l.y})`}
              style={{ animationDelay: `${(i * 0.55).toFixed(2)}s` }}
            >
              <path d={PIN_PATH} />
              <circle cx="0" cy="-9.2" r="1.7" />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
