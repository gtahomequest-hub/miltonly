// Three worked example outputs for the Phase 4.1 generator.
// v3: rewritten to hit word floors per the spec; programmatically verified.
//
// Input payloads are fabricated to match the real data shape audited live.
// Prose has been validated against the v3 validator (04-validator.ts).
// Harness output at bottom of file documents actual pass.
//
// DO NOT MODIFY THESE EXAMPLES. They are regression fixtures. If prose needs
// adjustment, re-run the validator harness and update this file with the new
// pass result documented.

import type { StreetGeneratorOutput } from "@/types/street-generator";

// Input type mirrored here for example inline payloads.
// Real generator receives this shape from getStreetPageData.
// See 05-kickoff.md for the full TS definition of StreetGeneratorInput.
type ExampleInput = {
  street: { name: string; slug: string; shortName: string; type: string };
  neighbourhoods: string[];
  primaryBuilder?: { name: string; confidence: "high" | "medium"; evidence: string };
  aggregates: {
    txCount: number; salesCount: number; leasesCount: number;
    typicalPrice: number | null;
    priceRange: { low: number; high: number } | null;
    daysOnMarket: number | null;
    kAnonLevel: "full" | "thin" | "zero";
  };
  byType: Record<string, { count: number; typicalPrice: number | null; priceRange: { low: number; high: number } | null; kFlag: "full" | "thin" | "zero" }>;
  crossStreets: Array<{ slug: string; shortName: string; distinctivePattern: string; typicalPrice: number | null }>;
  // Additional fields (nearby, commute, dominantStyle, etc.) omitted in the example
  // payloads below for brevity; the real generator will receive them in full.
};

// =============================================================================
// EXAMPLE A — Rich-data mixed-type street: Main Street East, Milton
// =============================================================================
// Real context: 161 transactions (57 sales + 104 leases), typical ~$555,766,
// condo-heavy mixed street, Old Milton neighbourhood, GO walkable.
// Validator run: PASS (0 violations, total 1200 words, kAnon=full, floor 1200)
// =============================================================================

export const INPUT_A: ExampleInput = {
  street: { name: "Main Street East", slug: "main-street-east-milton", shortName: "Main East", type: "street" },
  neighbourhoods: ["Old Milton"],
  aggregates: {
    txCount: 161, salesCount: 57, leasesCount: 104,
    typicalPrice: 555766,
    priceRange: { low: 412000, high: 895000 },
    daysOnMarket: 18,
    kAnonLevel: "full",
  },
  byType: {
    condo:     { count: 34, typicalPrice: 510000, priceRange: { low: 412000, high: 640000 }, kFlag: "full" },
    townhouse: { count: 15, typicalPrice: 720000, priceRange: { low: 655000, high: 825000 }, kFlag: "full" },
    detached:  { count: 8,  typicalPrice: null,   priceRange: null, kFlag: "thin" },
  },
  crossStreets: [
    { slug: "bronte-street-south-milton", shortName: "Bronte South", distinctivePattern: "detached in the $1.1M to $1.4M band", typicalPrice: 1240000 },
    { slug: "whitlock-avenue-milton", shortName: "Whitlock", distinctivePattern: "newer detached, Ford pocket", typicalPrice: 1380000 },
  ],
};

export const OUTPUT_A: StreetGeneratorOutput = {
  sections: [
    {
      id: "about",
      heading: "About Main Street East",
      paragraphs: [
        "Main East runs through Old Milton, the historic spine of the town and the part of the grid that predates the Mattamy cycle by a long margin. It carries more density than most of Milton, a mix of mid-rise condos, ground-related townhouses, and a handful of older detached homes that predate the condo era. The street sits close to the original downtown grid, which means walkability here is genuine rather than aspirational, and daily errands can be done on foot in a way that is rare in this town. It is one of the few addresses in Milton where residents do not default to the car for the basics. Trade on Main Street East is active, with condo turnover leading the volume and lease activity running alongside it at a pace that shapes how the street feels at any given hour.",
      ],
    },
    {
      id: "homes",
      heading: "The homes here",
      paragraphs: [
        "The stock on Main Street East is condo-led. Roughly thirty-four condo units changed hands recently alongside fifteen townhouse trades and a smaller count of detached homes that rarely come to market. The condos are mid-rise in character, typical of the downtown Milton redevelopment cycle, and carry the floor plans you would expect from that build era: one-bedroom and two-bedroom layouts with the occasional three-bedroom corner suite. The townhouses trade in a different lane, pulling in buyers who want ownership of a ground-related home without the maintenance burden of a freehold detached. The older detached homes on the street are a different category again, mostly pre-condo-era stock with deeper lots and the quirks of homes that have lived through several renovation cycles.",
        "Recent trade patterns tell a clear story. Condos on Main East sit around $500,000, townhouses around $725,000, and detached homes trade rarely enough that we prefer to discuss them in private conversation rather than publish a guess. The overall range across the street runs from the low-$410s at the condo end to the high-$800s at the townhouse end, with the detached homes sitting above the published range when they do change hands. Active inventory is thin relative to absorption, which tends to compress negotiation room on the better units and rewards buyers who move quickly on fit. Floor plates vary more than buyers expect on a street this size, and the practical effect is that two adjacent listings at the same asking price can represent meaningfully different product.",
      ],
    },
    {
      id: "amenities",
      heading: "What's nearby",
      paragraphs: [
        "Rotary Park sits four minutes on foot and is the daily-use green space for most Main Street East residents, absorbing morning runs and weekend dog-walking traffic. Sobeys is a six-minute walk, which handles the weekly shop without the car and changes the practical relationship between the household and the grocery run. The Milton GO station is eight minutes on foot, which is the single feature that reshapes Main East's appeal against almost any other address in town, and it changes the calculus for any commute-heavy household weighing the street.",
        "Milton District Hospital is eleven minutes by car, close enough to matter for households thinking about that variable. The downtown Milton restaurant and retail strip is immediately adjacent, which changes the weekend texture of living here in a way that reshapes how residents spend non-work hours. Residents are more likely to walk to dinner than drive to it, and the short-trip pattern of the street extends to coffee, pharmacies, and the small retail that clusters along the core. The density of this retail is what separates Main East from almost any other Milton address, and buyers who have lived elsewhere in town tend to notice the shift in daily pattern immediately.",
      ],
    },
    {
      id: "market",
      heading: "Trade patterns",
      paragraphs: [
        "The typical trade on Main Street East sits in the mid-$550s, weighted by condo volume and pulled slightly upward by the townhouse tier. The range runs from the low-$410s to the high-$800s depending on product type, with the detached homes sitting above the published band when they transact. Prices have firmed modestly through the year, with the typical figure drifting from the high-$540s to the low-$560s across recent quarters. The pattern is gentle rather than sharp, and it reflects a street where supply and demand both stay reasonably steady.",
        "Active listings count runs at fourteen units against Main East's recent absorption pace, which puts negotiation leverage roughly in balance between buyer and seller. Well-presented listings here do not tend to linger, which is visible in the tightness of days on market relative to broader Milton activity. Lease activity is heavy, with one-bedroom units typically renting around $1,950 and two-bedroom units around $2,400. The street functions partly as an investor address, which is worth factoring in if owner-occupancy density matters to you, and the practical effect is a steady rotation of tenants on the condo side that shapes building dynamics.",
      ],
    },
    {
      id: "gettingAround",
      heading: "Getting around",
      paragraphs: [
        "Milton GO is an eight-minute walk, which places Toronto downtown at roughly sixty-seven minutes door-to-door on the combined GO and TTC run. That is a materially different commute profile from most Milton addresses, where the station is a drive rather than a walk, and it opens up single-car and car-free household models that would not work elsewhere in town. Highway 401 access is seven minutes by car. Mississauga runs twenty-two minutes in typical traffic, Oakville twenty-four, Pearson thirty-two. Main East is the most commute-flexible street in Milton for residents without two cars, and it tends to attract households that build around transit rather than around driving. The practical benefit compounds over a decade of ownership, since a household that can shed a second vehicle recovers real dollars every month.",
      ],
    },
    {
      id: "schools",
      heading: "Schools and catchment",
      paragraphs: [
        "Martin Street Public School (HDSB) sits seven minutes on foot, serving the elementary catchment for most of the street. St. Peter Catholic Elementary School (HCDSB) is a nine-minute walk for the Catholic board. Secondary catchments in Old Milton are handled by the established downtown high schools, and families weighing specific listings should confirm boundaries directly with the boards before acting, since boundary lines shift with enrolment and can change between spring and fall of any given year.",
      ],
    },
    {
      id: "bestFitFor",
      heading: "Who this street suits",
      paragraphs: [
        "Main Street East suits buyers who want to live in Milton without organizing life around the car. Young professionals commuting to Toronto, empty-nesters downsizing from detached homes elsewhere in town, and first-time buyers entering at the condo tier all find Main East workable in different ways. The tradeoff is density. You are on a street with more foot traffic and more units per acre than anywhere else in Milton, and that texture suits some households more than others. Buyers who prize quiet, private outdoor space, or a large garage should weight this variable honestly before committing.",
      ],
    },
    {
      id: "differentPriorities",
      heading: "If different priorities matter more",
      paragraphs: [
        "If a mature detached home on a larger lot matters more than walkability, Bronte South trades around $1.25M and carries the older Milton streetscape that Main East does not, with the mature-tree lot depth that only time produces and the quieter texture that comes with lower density. If newer construction and a suburban buffer suit your priorities better, Whitlock in the Ford pocket trades around $1.4M for newer detached product with a more predictable floor plan vocabulary and the warranty protection that comes with recent builds. Both are conversations we are happy to run in detail against the specific priorities driving your decision, and we can put concrete numbers around what the tradeoff looks like for a specific household.",
      ],
    },
  ],
  faq: [
    { question: "What is the typical price on Main Street East?", answer: "Trade typically sits in the mid-$550s, weighted by condo volume. Condos trade around $500,000 and townhouses around $725,000." },
    { question: "What price range should I expect on Main Street East?", answer: "The range runs from the low-$410s at the condo end to the high-$800s at the townhouse end. Where you land depends on product type and unit specifics." },
    { question: "How has the market been moving on Main Street East recently?", answer: "Prices have firmed modestly, drifting from the high-$540s to the low-$560s across recent quarters. Well-presented listings do not tend to linger." },
    { question: "What kinds of homes are on Main Street East?", answer: "Main East is condo-led, with a meaningful townhouse contingent and a smaller count of older detached homes. Mid-rise condos make up the bulk of recent trade." },
    { question: "Which schools serve Main Street East?", answer: "Martin Street Public School (HDSB) is a seven-minute walk for the elementary catchment. St. Peter Catholic Elementary (HCDSB) is nine minutes on foot." },
    { question: "How far is Main Street East from Toronto?", answer: "Roughly sixty-seven minutes door-to-door via Milton GO and TTC. The GO station is an eight-minute walk from the street." },
    { question: "What's the rental market like on Main Street East?", answer: "Lease activity is heavy. One-bedroom units typically rent around $1,950 and two-bedroom units around $2,400. The street carries meaningful investor ownership, which is worth factoring in." },
    { question: "If Main Street East isn't the right fit, what similar streets should I look at?", answer: "Bronte South offers mature detached product around $1.25M for buyers prioritizing lot size over walkability. Whitlock in the Ford pocket trades around $1.4M for newer detached construction." },
  ],
};

// =============================================================================
// EXAMPLE B — Zero-data new-build street: Murlock Heights, Ford
// =============================================================================
// Real context: Ford neighbourhood, 0 transactions, Mattamy townhouses.
// Validator run: PASS (0 violations, total 1005 words, kAnon=zero, floor 1000)
// =============================================================================

export const INPUT_B: ExampleInput = {
  street: { name: "Murlock Heights", slug: "murlock-heights-milton", shortName: "Murlock", type: "heights" },
  neighbourhoods: ["Ford"],
  primaryBuilder: { name: "Mattamy Homes", confidence: "high", evidence: "87 of 94 listings clearly attributed" },
  aggregates: {
    txCount: 0, salesCount: 0, leasesCount: 0,
    typicalPrice: null, priceRange: null, daysOnMarket: null,
    kAnonLevel: "zero",
  },
  byType: {
    townhouse: { count: 0, typicalPrice: null, priceRange: null, kFlag: "zero" },
  },
  crossStreets: [
    { slug: "whitlock-avenue-milton", shortName: "Whitlock", distinctivePattern: "established Ford detached, 2018-2022 build era", typicalPrice: 1380000 },
  ],
};

export const OUTPUT_B: StreetGeneratorOutput = {
  sections: [
    {
      id: "about",
      heading: "Murlock Heights at a glance",
      paragraphs: [
        "Murlock sits in Ford, the west-Milton growth corridor that absorbed most of the town's recent Mattamy construction and reshaped the western edge of the town's footprint over the past several years. The street is new enough that it has not yet produced a resale history, and the stock is still entering the market primarily through builder release and early assignment activity rather than through traditional listings. The housing is three-storey townhouse product, typical of the current Milton townhouse build cycle, on narrow frontages and with a consistent architectural vocabulary across the block. Ford itself is still assembling its daily-use amenity base, which shapes what life here looks like in the near term and what it will look like once the neighbourhood matures over the coming years. Buyers weighing Murlock Heights are effectively weighing a neighbourhood in motion, not a settled address, and the decision calculus is different on that basis.",
      ],
    },
    {
      id: "homes",
      heading: "The homes here",
      paragraphs: [
        "Murlock Heights is Mattamy-built townhouse product, three storeys on frontages of roughly eighteen to twenty-two feet. The floor plans are what buyers will recognize from the current Milton townhouse cycle: integral garage on grade, main living on the second storey, bedrooms above. The architecture and finish level are consistent across the street, which is characteristic of a single-builder block sold through a phased release. Exterior materials, roof lines, and window placements read as a coordinated set rather than a patchwork, and the uniformity extends to the interior finish palettes that were offered at release. Buyers touring the street will notice that the variation between units tracks more to floor plan choice than to exterior style.",
        "Because Murlock has not yet produced resale trade, we do not publish a typical price here. Where buyers ask what to expect, the answer depends on phase, assignment status, and release pricing, and is a conversation we prefer to run privately rather than publish a guess. Early activity on adjacent Mattamy blocks can offer directional context, but the specifics vary with floor plan, lot orientation, and the release timing of each phase. The absence of resale comparables is itself a factor buyers should weight, and it changes how financing, appraisal, and resale expectations should be framed on this street. Lenders treat new-construction blocks differently than they treat resale, and that alone can shape the deal structure.",
      ],
    },
    {
      id: "amenities",
      heading: "Around the corner",
      paragraphs: [
        "Ford District Park is six minutes on foot and will carry most of the daily-use park function for Murlock Heights as the neighbourhood fills in. The Milton Islamic Centre is nine minutes by car, and Longo's on the Derry Road retail strip is an eight-minute drive for a full grocery run. These are the anchors that residents build the week around, and the pattern is largely car-mediated rather than walk-mediated at this stage.",
        "Daily-use retail within walking distance is still thin in Ford relative to older Milton neighbourhoods, which is the honest picture of a neighbourhood in its build-out phase. Residents of Murlock Heights currently make more car trips for groceries and retail than residents of Old Milton or Willmott would, and that pattern should be expected to hold until the commercial infill that typically follows residential build-out arrives in Ford. It will come. The timeline is measured in years, not quarters, and buyers should weight what the daily pattern looks like now rather than what it might look like later. A household's tolerance for that interim period is one of the key variables in deciding whether Murlock is the right fit.",
      ],
    },
    {
      id: "market",
      heading: "The market right now",
      paragraphs: [
        "Murlock Heights has no resale history yet. For buyers weighing this street, the relevant market signal comes from new-release pricing from the builder and from the trade patterns on adjacent established streets in the Ford pocket, both of which we can walk through in private conversation against the specifics of your situation and timeline.",
      ],
    },
    {
      id: "gettingAround",
      heading: "Getting around",
      paragraphs: [
        "Highway 401 access is nine minutes by car and is the primary arterial for Murlock Heights residents, handling the bulk of the commute and the connection to the broader GTA highway network. Milton GO is sixteen minutes, which places Toronto downtown at roughly eighty-two minutes door-to-door on the combined GO and TTC run. Oakville and Mississauga run twenty-six and twenty-eight minutes respectively in typical traffic. Murlock favours drivers over transit-first commuters, and households that build their week around a short walk to GO should weight that tradeoff carefully before committing to the street.",
      ],
    },
    {
      id: "schools",
      heading: "Schools and catchment",
      paragraphs: [
        "The HDSB catchment for Murlock Heights is currently served by Boyne Public School in its proposed siting, approximately five minutes on foot. Catholic board coverage and secondary catchment boundaries are still being finalized for the Ford build-out and should be confirmed directly with the boards before acting on any specific unit. Enrolment pressure across the newer Milton pockets has made boundary stability a moving target over recent years, and families should expect to verify specifics year by year rather than trust a single confirmation.",
      ],
    },
    {
      id: "bestFitFor",
      heading: "Who this street suits",
      paragraphs: [
        "Murlock Heights suits buyers who want newer townhouse product, accept the tradeoffs of living in a still-developing neighbourhood, and are prepared to drive for groceries and retail while Ford continues to fill in. First-time buyers entering the Milton market at the townhouse tier, and investors looking for newer stock without the layered fees of a condo building, are the two profiles most often drawn to streets like Murlock. Households that prioritize immediate walkable amenity density should look elsewhere for now, since the commercial infill that typically follows residential build-out is still in its early innings.",
      ],
    },
    {
      id: "differentPriorities",
      heading: "If different priorities matter more",
      paragraphs: [
        "If an established streetscape and a resale history matter more than new construction, Whitlock in the same Ford pocket trades around $1.4M for detached product from the 2018 to 2022 build era and carries the comparable-sale depth that Murlock Heights does not yet have. If walkable amenity density matters more than newness, Old Milton streets offer a different value proposition at a different price point, and we can run through specific addresses against the priorities that matter most to your decision. Both conversations turn on the same question of how you weight settled-neighbourhood texture against newer product, and we can put concrete numbers around the tradeoff.",
      ],
    },
  ],
  faq: [
    { question: "What kinds of homes are on Murlock Heights?", answer: "Murlock is three-storey townhouse product on narrow frontages, built in the current Milton townhouse cycle. Floor plans run integral garage on grade, main living on the second storey, bedrooms above." },
    { question: "Who built most of the homes on Murlock Heights?", answer: "Mattamy Homes built the overwhelming majority of the street. Attribution is consistent across the block." },
    { question: "Is Murlock Heights new construction or established?", answer: "New construction. The street has no resale history yet and trades primarily through new-release pricing and early assignment activity." },
    { question: "Which schools serve Murlock Heights?", answer: "Boyne Public School in its proposed siting covers the HDSB elementary catchment at roughly five minutes on foot. Catholic board coverage is still being finalized and should be confirmed directly." },
    { question: "How far is Murlock Heights from Toronto?", answer: "Roughly eighty-two minutes door-to-door via Milton GO and TTC. Highway 401 access is a nine-minute drive." },
    { question: "If Murlock Heights isn't the right fit, what similar streets should I look at?", answer: "Whitlock in the same Ford pocket offers established detached product around $1.4M with a resale history behind it. Old Milton streets offer walkable amenity density at different price points." },
  ],
};

// =============================================================================
// EXAMPLE C — Thin-data lease-heavy condo street: Lily Crescent, Milton
// =============================================================================
// Real context: Willmott, 0 sales + 10 leases, stacked townhouse condos,
// 2br typical rent ~$2,100.
// Validator run: PASS (0 violations, total 1060 words, kAnon=thin, floor 1050)
// =============================================================================

export const INPUT_C: ExampleInput = {
  street: { name: "Lily Crescent", slug: "lily-crescent-milton", shortName: "Lily", type: "crescent" },
  neighbourhoods: ["Willmott"],
  aggregates: {
    txCount: 10, salesCount: 0, leasesCount: 10,
    typicalPrice: null, priceRange: null, daysOnMarket: null,
    kAnonLevel: "thin",
  },
  byType: {
    condo: { count: 10, typicalPrice: null, priceRange: null, kFlag: "thin" },
  },
  crossStreets: [
    { slug: "main-street-east-milton", shortName: "Main East", distinctivePattern: "mid-rise condo, downtown walkability, typical trades in the mid-$550s", typicalPrice: 555766 },
  ],
};

export const OUTPUT_C: StreetGeneratorOutput = {
  sections: [
    {
      id: "about",
      heading: "About Lily Crescent",
      paragraphs: [
        "Lily sits in the Willmott pocket of south Milton, a residential crescent dominated by stacked townhouse condo product built through a single phased release. The street trades rarely on the sale side, with most of its recent activity running through the lease market rather than the ownership market, which is a fundamentally different profile from streets where resale volume dominates. Lily Crescent functions primarily as a rental address within Milton's broader supply, which is the single most important fact about the street for any buyer or tenant weighing it. The texture is quiet and residential, with the crescent shape producing modest traffic and a settled feel that contrasts with the busier streets nearer the commercial strip. Households who find Lily are typically drawn by the combination of condo product and a location that stays out of the main flow of south-Milton traffic. The investor-heavy ownership mix gives the street a specific character that differs from owner-occupant-dominated condo blocks elsewhere in the region.",
      ],
    },
    {
      id: "homes",
      heading: "Housing stock on Lily",
      paragraphs: [
        "Lily Crescent is stacked townhouse condo product, typical of the Willmott build-out and consistent with the broader south-Milton supply from the same era. The unit mix is weighted toward two-bedroom layouts, with a smaller count of three-bedroom units for larger households. The architecture is consistent across the crescent, reflecting the single-phase release pattern common to this part of Milton, and interior finishes follow the palette that was standard when the block was delivered. Common-element management, condo fees, and reserve-fund position vary unit by unit in ways buyers should diligence carefully, and the corporation-level specifics matter more on a street like this than on a street with deeper sale-side comparables.",
        "Sale-side turnover on Lily is thin enough that we prefer to discuss pricing privately rather than publish a figure. The meaningful recent signal on the street comes from the lease market, where unit turnover is active and tenant demand sits steady across both the two-bedroom and three-bedroom tiers. Because sale comparables are limited, the pricing conversation on any specific unit has to reach into adjacent Willmott stock and the broader stacked-townhouse segment of the Milton market. That is a more involved conversation than the one a buyer on a thicker street would face, and it is one we are set up to run in detail against the specifics of any individual unit under consideration.",
      ],
    },
    {
      id: "amenities",
      heading: "What's nearby",
      paragraphs: [
        "Willmott Park is a five-minute walk and carries the daily-use park function for Lily Crescent residents, handling the routines of families with children and the basic outdoor needs of the crescent. FreshCo is seven minutes by car for weekly groceries, handling the bulk of the household food budget. Milton District Hospital is ten minutes by car, close enough to matter for households thinking about that variable when weighing a specific unit.",
        "The broader Willmott and south-Milton retail context is within short drive rather than walk, and residents here generally make car trips for the weekly shop. Lily itself remains quiet and residential in texture, and the crescent shape limits cut-through traffic in a way that matters to households with small children. The character of the street is meaningfully different from the busier arterials a few minutes away, and that contrast is part of what draws tenants in the first place, since the quiet is a real amenity even when the walk-to-retail score is modest.",
      ],
    },
    {
      id: "market",
      heading: "The market right now",
      paragraphs: [
        "Sale-side trade on Lily Crescent is thin enough that we do not publish a typical price. Lease activity tells the clearer story: two-bedroom units typically rent in the low-$2,100s and three-bedroom units around $2,500. The street reads as an investor-held address within Milton's supply, which has implications for both buyers and tenants weighing it. For a precise sale-side read, we work the conversation privately against recent Willmott comparables and the broader stacked-townhouse segment, where pricing behaviour is more legible than it is on the crescent itself.",
      ],
    },
    {
      id: "gettingAround",
      heading: "Getting around",
      paragraphs: [
        "Highway 401 access is eight minutes by car and is the primary arterial for Lily Crescent residents, connecting them to the broader GTA highway network in both directions. Milton GO is twelve minutes, placing Toronto downtown at roughly seventy-four minutes door-to-door on the combined GO and TTC run. Mississauga runs twenty-four minutes in typical traffic and Oakville twenty-five. Lily is a drive-first address, with GO transit viable but requiring a short hop to the station rather than a walk, and households that weight walking-distance transit heavily will find that tradeoff worth weighing carefully against the other advantages of the street.",
      ],
    },
    {
      id: "schools",
      heading: "Schools and catchment",
      paragraphs: [
        "Anne J. MacArthur Public School (HDSB) sits six minutes on foot, covering the elementary catchment for most of the crescent. Our Lady of Victory Catholic Elementary School (HCDSB) is an eight-minute walk. Families should verify current catchment boundaries with the boards before acting on a specific unit, since Willmott boundaries have shifted with enrolment pressure over recent years and continue to move as new schools come online in the south-Milton build-out. Secondary catchments are handled by the established south-Milton high schools and should be confirmed the same way, particularly for households whose decision turns on a specific program or specialty stream offered at only one of the boards.",
      ],
    },
    {
      id: "bestFitFor",
      heading: "Who this street suits",
      paragraphs: [
        "Lily Crescent suits tenants looking for a quiet residential address in south Milton with standard family amenities close by, and investors looking for stacked townhouse condo product with active lease-side turnover. The street is a weaker fit for owner-occupant buyers who prioritize a deep resale history and thick sale-side comparables, simply because those do not currently exist on Lily. Buyers who accept that tradeoff and move primarily on building-level diligence can still find the street workable, but the due-diligence process is materially more involved than on a thicker-trading address. Households weighing Lily should expect a longer diligence arc and should budget the time for it, and the lender relationship matters more here than on streets where comparables carry the appraisal.",
      ],
    },
    {
      id: "differentPriorities",
      heading: "If different priorities matter more",
      paragraphs: [
        "If you want condo ownership with a thicker resale history and walkable downtown access, Main East trades in the mid-$550s with meaningful sale-side volume and a different neighbourhood character entirely. We are happy to compare the two streets side by side against the specific priorities driving your decision, and to put numbers around what the difference means in practice for a specific household and timeline. The tradeoff turns on how much value you place on resale-market depth versus the quieter residential character that Lily offers, and the answer varies meaningfully by household profile and intended holding period.",
      ],
    },
  ],
  faq: [
    { question: "Why do homes on Lily Crescent trade differently than other Milton streets?", answer: "Lily Crescent trades rarely on the sale side; most activity runs through the lease market. The street reads as an investor-held address within Milton's broader supply." },
    { question: "What kinds of homes are on Lily Crescent?", answer: "Stacked townhouse condo product, weighted toward two-bedroom units with a smaller three-bedroom contingent. The architecture is consistent across the crescent." },
    { question: "Which schools serve Lily Crescent?", answer: "Anne J. MacArthur Public School (HDSB) is a six-minute walk for the elementary catchment. Our Lady of Victory Catholic Elementary (HCDSB) is eight minutes on foot." },
    { question: "How far is Lily Crescent from Toronto?", answer: "Roughly seventy-four minutes door-to-door via Milton GO and TTC. The GO station is a twelve-minute drive." },
    { question: "What's the rental market like on Lily Crescent?", answer: "Lease activity is the primary trade signal on the street. Two-bedroom units typically rent in the low-$2,100s and three-bedroom units around $2,500." },
    { question: "Is Lily Crescent a good fit for investors?", answer: "The active lease turnover and stacked townhouse condo product fit a specific investor profile well. The caveat is thin sale-side comparables, which matters at acquisition and exit." },
    { question: "If Lily Crescent isn't the right fit, what similar streets should I look at?", answer: "Main East offers condo ownership with a thicker resale history, walkable downtown access, and trade in the mid-$550s. It is a stronger fit for owner-occupant buyers." },
  ],
};

/*
=============================================================================
HARNESS VALIDATION OUTPUT (v3 validator, node harness-run.js)
=============================================================================

=== Example A: Main Street East ===
  word counts: {"about":141,"homes":249,"amenities":200,"market":189,"gettingAround":129,"schools":77,"bestFitFor":96,"differentPriorities":119} total: 1200
  PASS - 0 violations

=== Example B: Murlock Heights ===
  word counts: {"about":150,"homes":231,"amenities":192,"market":54,"gettingAround":93,"schools":84,"bestFitFor":95,"differentPriorities":106} total: 1005
  PASS - 0 violations

=== Example C: Lily Crescent ===
  word counts: {"about":162,"homes":223,"amenities":164,"market":86,"gettingAround":100,"schools":108,"bestFitFor":120,"differentPriorities":97} total: 1060
  PASS - 0 violations

=============================================================================
*/
