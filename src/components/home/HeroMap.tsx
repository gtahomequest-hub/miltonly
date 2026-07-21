// src/components/home/HeroMap.tsx
//
// Stylized inline SVG sketch of Milton for the hero background (2026-07-21,
// Aamir-directed). Deliberately simplified, NOT cartographically exact: the
// recognizable road skeleton, the Escarpment edge, a rough town boundary,
// and faint neighbourhood labels positioned approximately. Line work +
// labels only - no area fills, no water/parks. One dull faded-yellow tone;
// the container's opacity (home-theme.css .m-heromap) keeps it a background
// texture that never competes with the hero text. Zero JS, zero deps, no
// external fetch; aria-hidden + pointer-events:none.

export function HeroMap() {
  return (
    <div className="m-heromap" aria-hidden="true">
      <svg
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        {/* town boundary - dashed, slightly quieter than the roads */}
        <path
          className="mh-boundary"
          d="M160,100 L1120,68 L1162,690 L205,752 Z"
        />

        {/* Niagara Escarpment edge - twin wavy strokes, west side */}
        <path
          className="mh-esc"
          d="M212,118 C 182,220 220,320 190,420 C 168,520 208,620 178,732"
        />
        <path
          className="mh-esc mh-esc2"
          d="M236,122 C 206,222 242,322 214,422 C 192,522 230,622 202,728"
        />

        {/* highways - a touch heavier */}
        <path className="mh-hwy" d="M122,192 C 400,152 800,122 1158,110" />
        <path className="mh-hwy" d="M982,62 C 1040,92 1100,94 1158,152" />

        {/* arterials */}
        <path className="mh-road" d="M262,262 C 500,246 800,226 1140,206" />
        <path className="mh-road" d="M232,432 C 450,416 600,382 780,371 C 900,363 1000,360 1140,351" />
        <path className="mh-road" d="M202,562 C 500,541 900,506 1155,481" />
        <path className="mh-road" d="M232,702 C 550,676 900,641 1150,616" />
        <path className="mh-road" d="M332,242 C 326,400 332,550 321,722" />
        <path className="mh-road" d="M661,236 C 666,380 656,520 666,702" />
        <path className="mh-road" d="M901,142 C 941,260 901,420 931,560 C 941,610 931,652 941,692" />

        {/* road labels */}
        <text className="mh-rlabel" x="948" y="100">401</text>
        <text className="mh-rlabel" x="1092" y="88">407</text>
        <text className="mh-rlabel" x="998" y="198">Steeles Ave</text>
        <text className="mh-rlabel" x="1008" y="344">Main St</text>
        <text className="mh-rlabel" x="1012" y="474">Derry Rd</text>
        <text className="mh-rlabel" x="994" y="608">Britannia Rd</text>
        <text className="mh-rlabel" x="312" y="648" transform="rotate(-87 312 648)">Bronte St</text>
        <text className="mh-rlabel" x="680" y="648" transform="rotate(-88 680 648)">Thompson Rd</text>
        <text className="mh-rlabel" x="958" y="312" transform="rotate(-83 958 312)">James Snow Pkwy</text>
        <text className="mh-rlabel" x="176" y="360" transform="rotate(-80 176 360)">Niagara Escarpment</text>

        {/* neighbourhood labels - roughly placed relative to the roads */}
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
      </svg>
    </div>
  );
}
