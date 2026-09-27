# MC-042 fabrication review

Every claim on the three generated pages traced to `StreetGeneration.inputJson` (the only facts the model was given), by three independent lenses per page (numeric grounding; physical, place and qualitative grounding; compliance and voice). Each raised finding then went to three skeptics told to refute it (one reading the aggregates, one the place blocks, one the validator code and CLAUDE.md); a finding survives on two or more upheld votes. Workflow `wf_721a5496-7e1`, 477 agents.

| page | lens | claims traced | raised |
|---|---|---|---|
| gowland-crescent-milton | numeric | 105 | 20 |
| gowland-crescent-milton | physical | 78 | 20 |
| gowland-crescent-milton | compliance | 131 | 18 |
| ennisclare-drive-milton | numeric | 91 | 15 |
| ennisclare-drive-milton | physical | 73 | 21 |
| ennisclare-drive-milton | compliance | 182 | 16 |
| jempson-path-milton | numeric | 76 | 13 |
| jempson-path-milton | physical | 74 | 16 |
| jempson-path-milton | compliance | 108 | 17 |

Raised 156 · refuted 41 · upheld 115, which deduplicate to **69 distinct findings**: **32 visible on the live page**, 2 in the served HTML head only (the meta description), 35 in stored text the renderer cuts (`stripNumericParagraphs`), so never served.

Visible findings by severity: fabrication 16 · minor 12 · voice 4.

Served means the quote was found in the production page fetched after publishing (`served-<slug>.txt` holds exactly what was served). The three pages were returned to draft afterwards (`unpublish.log`).

## Served, visible

### gowland-crescent-milton

- **fabrication** · differentPriorities (SERVED live) · lenses numeric+physical
  - quote: "A buyer weighing lot size against finished square footage will find the tradeoffs land differently on each."
  - This claims the comparator streets differ on lot size and finished square footage. The input has no lot size or square footage for any street. The sentence survived the numeric filter and is served.
- **minor** · differentPriorities (SERVED live) · lenses numeric+physical+compliance
  - quote: "If the priorities sit elsewhere, two nearby streets frame the alternatives."
  - The count 'two' reaches the live page, but both sentences naming the streets were stripped. The page promises two alternatives and names neither, and the next sentence's 'each' has nothing to refer to. 'Nearby' also has no distance field behind it.
- **voice** · about (SERVED live) · lenses numeric+physical+compliance
  - quote: "For anyone learning the geography of Timberlea, Gowland is a small but representative piece of it."
  - The short name 'Gowland' appears in prose, which the voice rule forbids. 'Small' is a size claim with no grounding field.
- **minor** · about (SERVED live) · lenses numeric+physical+compliance
  - quote: "It sits within a mature pocket of west Milton, framed by the parks and school grounds that give this part of town its shape."
  - No input field supports the compass placement ('west Milton') or the build age ('mature'). The Town centreline puts the street east of the Old Milton core.
- **fabrication** · about (LIVE) · lenses physical
  - quote: "The crescent's position puts it within easy reach of the grocery and retail cluster along the main commercial corridors, while keeping the immediate surroundings residential."
  - The input names no retail cluster and no commercial corridors, and has no land-use data for the immediate surroundings. The only shopping facts the model saw were four named grocers at 4–5 drive-minutes.
- **fabrication** · faq Q2 (LIVE, also in FAQPage JSON-LD) · lenses physical+compliance
  - quote: "There is no townhouse or semi-detached product mixed in. The detached profile is consistent across the crescent."
  - The answer stretches 3 detached sales in 12 months into a claim about every home on the street. The input covers only recent trades, not the 71-address housing stock. The stored homes section makes the same leap: "That single-type profile gives the street a consistent built character from end to end."
- **minor** · about S1 (LIVE: hero subtitle, about section, and the meta description prefix) · lenses physical+compliance
  - quote: "Gowland Crescent is a residential curve in Milton's Timberlea neighbourhood, the kind of street that bends back on itself and keeps its traffic local."
  - The loop layout ("bends back on itself") and "keeps its traffic local" come only from street.type "crescent"; the model saw no geometry. Town data happens to agree, so the sentence is true, but the model had no source for it.
- **minor** · neighbourhoodComparable (LIVE) · lenses physical
  - quote: "Taken together, the neighbourhood picture is one of steady, unhurried trade at a level that anchors what a detached home in this part of Milton has been worth."
  - "steady" claims stability over time, yet no year-over-year figure exists and the sentence just before it says "so no trend claim is made here". On the live page the 89-day figure behind "unhurried" is cut, so the characterisation shows with nothing supporting it.
- **voice** · sectionsJson.neighbourhoodComparable p0; SERVED under 'Comparable homes nearby' · lenses compliance
  - quote: "Year-over-year direction is not published for this scope, so no trend claim is made here."
  - Methodology and prompt text leaked into published prose: it describes what the page is not allowed to say. The next rendered sentence, 'Taken together, the neighbourhood picture is one of steady, unhurried trade...', then makes a 'steady' claim right after disclaiming any trend claim.
- **minor** · rendered page template, 'Places of worship' panel in Commute & reach · lenses compliance
  - quote: "Mosques, churches, gurdwaras"
  - The label promises churches and gurdwaras, but the panel lists only three mosques. On a fair-housing reading, a single-faith list under a multi-faith label reads as selective. The generated amenities prose (stored) likewise names only the mosques, because inputJson.nearby has only a 'mosques' field. The wording is neutral with no steering language, so this is a register and accuracy issue, not a violation.
- **minor** · rendered page template, Commute & reach > Schools, versus the Nearby side panel · lenses compliance
  - quote: "Chris Hadfield PS 8 min drive"
  - The same school gets two drive times on one page: the Nearby panel says 'Chris Hadfield PS 4 min drive', the commute panel says 8 min. One of them is wrong. Template data, not generated.

### ennisclare-drive-milton

- **fabrication** · market (sectionsJson market.paragraphs[1]); LIVE on the page · lenses numeric+physical+compliance
  - quote: "What can be said is that activity here is episodic: a home comes to market, and then the street goes quiet again for an extended period."
  - This makes up a sales pattern and a length of time. The input covers a single 12-month window with one sale. There are no sale dates or multi-year history, so nothing supports 'episodic' or 'goes quiet again for an extended period'. The live sentence above it, 'Ennisclare Drive trades rarely.', is a frequency claim built on the same single count, with no housing-stock denominator and no longer history.
- **fabrication** · faq[7] 'Is Ennisclare Drive new construction or established?'; LIVE in the FAQ and in the FAQPage JSON-LD · lenses numeric+physical
  - quote: "The street reads as established rather than new construction, with detached housing and very little turnover."
  - This is an age claim with no source. No input field gives build year, construction era or first-sale date. 'Very little turnover' is a rate, and a rate needs a housing-stock count, which the input does not have. Low resale activity also does not tell established stock apart from new construction. With no data, the answer should say the record does not show it.
- **fabrication** · LIVE page, deterministic layer (the 'Nearby' sidebar and the 'Commute & reach' grid; NOT generated text) · lenses numeric+compliance
  - quote: "Chris Hadfield PS 4 min drive | P.L. Robertson PS 4 min drive | Highway 401 on-ramp 5 min drive | Union Station (GO) 58 min transit | Chris Hadfield PS 8 min drive | Anne J. MacArthur PS 5 min drive | Irma Coulson PS 6 min drive | E.W. Foster PS 5 min drive | Tiger Jeet Singh PS 4 min drive | Kelso Conservation Area 12 min drive | Rattlesnake Point Conservation 20 min drive"
  - These travel times are made up or hard-coded, yet the page labels them 'Distances from this street's road centreline'. They contradict the street's real computed values: the generator input, computed from the same centreline, puts Chris Hadfield PS at 27 min and the 401 ramp at 26 min. The same school also appears at 4 min in one panel and 8 min in the other. The Nearby ItemList JSON-LD lists Chris Hadfield PS and P.L. Robertson PS as nearby places. This is not in the generated text, but it is invented numeric content on this live page, and likely on every street that has a coordinate.
- **minor** · neighbourhoodComparable (sectionsJson paragraphs[0]); LIVE · lenses numeric
  - quote: "Homes in this cohort have been taking time to clear, with days on market running well beyond what a busier Milton pocket would show, and the sold-to-ask relationship points to meaningful negotiation room rather than buyers paying at or near asking."
  - 'Taking time to clear' is supported by DOM 161 and 'negotiation room' by sold-to-ask 0.927. But 'well beyond what a busier Milton pocket would show', and the next sentence's 'slower, more deliberate market', compare against a Milton or other-neighbourhood figure the input does not contain.
- **minor** · about paragraphs[0]; LIVE as the hero subtitle, the About opener and the JSON-LD Place.description; also live 'This is countryside address territory: low-density, spread out, and framed by open land rather than subdivision streets.' · lenses numeric+compliance
  - quote: "Ennisclare Drive is a rural residential road in the Rural Nassagaweya area of Milton, sitting well north of the town's built-up grid."
  - 'Well north' is a direction-and-distance claim, and 'low-density' is a density claim. The input has no field for either: no coordinates, direction, density or land use. They are probably true, but nothing the model was given supports them.
- **minor** · amenities paragraphs[1] as rendered LIVE under 'What's nearby'; also live 'Homes in this cohort have been taking time to clear...' opening 'Comparable homes nearby' · lenses numeric+physical
  - quote: "On the Catholic side, Holy Rosary Catholic ES, St. Peter Catholic ES, and Bishop P.F. Reding Catholic SS sit in the same range."
  - After numeric-sentence suppression, the live page says 'Schools are spread across the surrounding area. On the Catholic side, ... sit in the same range.' 'The same range' refers to a range ('mid-to-high twenties') that was stripped, so the page asserts a quantity the reader cannot see. The live comparable section likewise opens on 'this cohort' after the sentence defining the cohort was removed.
- **fabrication** · about (hero subtitle, About section, JSON-LD Place.description; also StreetContent.description) · lenses physical
  - quote: "sitting well north of the town's built-up grid"
  - Ungrounded direction and position claim that is also wrong in its main direction. No inputJson field gives location or bearing. The Town centroid puts the street well WEST of the urban grid, not well north. It is live in three places.
- **fabrication** · about (rendered live; StreetContent.description) · lenses physical
  - quote: "This is countryside address territory: low-density, spread out, and framed by open land rather than subdivision streets."
  - Invented land-use and surroundings claim. No inputJson field covers density, lot pattern, open land or subdivision form; the only support for 'rural' is the neighbourhood name. Town data shows a lotted residential street, not a road framed by open land, and the same page contradicts it lower down.
- **fabrication** · live page, 'Commute & reach from Ennisclare Drive' block (deterministic, not model output); also 'Union Station (GO) 58 min transit', 'Kelso Conservation Area 12 min drive', 'Rattlesnake Point Conservation 20 min drive' · lenses physical
  - quote: "Highway 401 on-ramp 5 min drive"
  - Hardcoded place times, identical on every street, published as this street's. They contradict the street's own generator input: 401 at 26 min, Toronto 88 min.
- **fabrication** · live page, 'Commute & reach' Schools list (deterministic): 'Chris Hadfield PS 8 min drive / Anne J. MacArthur PS 5 min drive / Irma Coulson PS 6 min drive / E.W. Foster PS 5 min drive / Tiger Jeet Singh PS 4 min drive'; also the 'Around Ennisclare Drive' schools list · lenses physical
  - quote: "Chris Hadfield PS 8 min drive"
  - Made-up school drive times from a name-length formula, applied to the first five schools in the file regardless of where the street is. These are urban schools about 16 km away. Input gives Chris Hadfield PS as 27 min, and the real nearest school, Brookville ES (8 min), is missing.
- **fabrication** · live page 'Nearby' sidebar and JSON-LD ItemList 'Places near Ennisclare Drive' (deterministic); also 'P.L. Robertson PS 4 min drive' · lenses physical
  - quote: "Chris Hadfield PS 4 min drive"
  - Made-up distances that the caption credits to Town data, and that are sent to search engines as structured data. The caption says 'Distances from this street's road centreline. Contains information licensed under the Open Government Licence – Milton.' The school km values are invented constants.
- **minor** · neighbourhoodComparable (rendered live) · lenses physical
  - quote: "with days on market running well beyond what a busier Milton pocket would show"
  - Comparison against other Milton areas with nothing to compare to. The input has the neighbourhood's DOM (161) but no Milton-wide or other-area DOM. It happens to be true (the page header shows urban Milton at 28 days), but the model did not have that figure.
- **fabrication** · rendered page, 'Commute & reach from Ennisclare Drive' grid (non-generated) · lenses compliance
  - quote: "Chris Hadfield PS 8 min drive | Anne J. MacArthur PS 5 min drive | Irma Coulson PS 6 min drive | E.W. Foster PS 5 min drive | Tiger Jeet Singh PS 4 min drive | Highway 401 on-ramp 5 min drive | Union Station (GO) 58 min transit | Kelso Conservation Area 12 min drive | Rattlesnake Point Conservation 20 min drive"
  - These are made-up travel times published as facts about this street. The school minutes come from a formula on the school name's length. The 401, Union and conservation-area times are constants that every street shows. All of them contradict the generator input for this rural street.
- **voice** · rendered page, 'Where this street sits' area-context card (template, not generated) · lenses compliance
  - quote: "Too few recent trades on Ennisclare Drive to price it on its own yet, the Nassagaweya market is your best guide to what you'd pay here, and this page fills in with Ennisclare Drive's own numbers as homes trade."
  - 'best guide' is a superlative. The same phrasing is on condo pages.
- **voice** · rendered 'What's nearby' (sec amenities p1 after stripNumericSentences) · lenses compliance
  - quote: "Schools are spread across the surrounding area. On the Catholic side, Holy Rosary Catholic ES, St. Peter Catholic ES, and Bishop P.F. Reding Catholic SS sit in the same range."
  - Stripping the numeric sentences left a broken paragraph. 'sit in the same range' points back at 'mid-to-high twenties', which was cut. 'On the Catholic side' now contrasts with nothing, because the public-school sentence (Brookville ES, the nearest school) was also removed. As a result, the only schools the rendered prose names are Catholic-board schools. The wording does not steer anyone, but naming one denomination's schools only reads badly on a real-estate page. The coherence pass does not catch mid-sentence back-references such as 'the same range'.

### jempson-path-milton

- **fabrication** · neighbourhoodComparable (RENDERED under 'Comparable homes nearby'); also faq[1] 'The broader Harrison market for townhomes has been steady' and the section opener 'have sold at broadly consistent levels over the past year' (both stored only) · lenses numeric+physical+compliance
  - quote: "Taken together, the neighbourhood picture is one of steady, unspectacular trade in townhouse stock"
  - This is a price-trend or stability claim with no data behind it. It comes straight after the section's own sentence 'Year-over-year direction is not published for this comparable set, so no trend read is offered here', so the page contradicts itself in the rendered text.
- **fabrication** · about (RENDERED: hero subtitle, About section, JSON-LD Place.description, and the live meta description) · lenses numeric
  - quote: "a pocket of the town that has filled in around a mix of townhouse rows and detached homes"
  - No input field mentions detached homes. The input records only townhouses, and faq[2] (also rendered) says 'that is the only housing type recorded here. The mix is uniform rather than varied', which contradicts this sentence. 'Has filled in' is also a development-history claim with no source.
- **fabrication** · faq[7] (RENDERED in Common questions and in the FAQPage JSON-LD) · lenses numeric+physical+compliance
  - quote: "The street is established, with the surrounding Harrison area built out rather than still under development."
  - The answer claims a build era and development status, and nothing in the input supports either. The FAQ bank forces this question on every street, so any answer is made up unless the input carries build-era data.
- **fabrication** · about (sections[0], sentence 1). LIVE: this sentence is the hero subtitle, the first sentence of the rendered About section, and the Place JSON-LD description. As StreetContent.description's first sentence it also feeds characterSummary and the meta description. · lenses physical+compliance
  - quote: "Jempson Path is a residential street in Milton's Harrison area, a pocket of the town that has filled in around a mix of townhouse rows and detached homes."
  - This invents Harrison's housing mix ("townhouse rows and detached homes"), a build-out history ("has filled in") and a physical form ("rows"). No input field describes the neighbourhood's stock or how it was built. It is the most visible sentence on the page and it goes into structured data.
- **minor** · live page chrome: sidebar 'Nearby' vs 'Commute & reach' block (not generated) · lenses compliance
  - quote: "Chris Hadfield PS 4 min drive"
  - The page contradicts itself: the sidebar shows Chris Hadfield PS at 4 min and the commute block shows 'Chris Hadfield PS 8 min drive'. The commute block also shows 'Tiger Jeet Singh PS 4 min drive' and 'Highway 401 on-ramp 5 min drive', while the generator input had 6 and 8. Three sources disagree on the same distances.
- **minor** · live page chrome, 'Leases' card in 'Recent activity' (not generated) · lenses compliance
  - quote: "Rental activity on Jempson Path across recent months. Breakdown by bed count below."
  - The copy points to a bed-count breakdown that does not render, because typical rent is suppressed with 1 lease. Similarly, the 'Places of worship' subtitle 'Mosques, churches, gurdwaras' sits over a list of three mosques only.

## Served, HTML head only

### jempson-path-milton

- **minor** · meta (live <meta name=description>, built by page.tsx fitDescription from the About lead) · lenses numeric
  - quote: "Jempson Path is a residential street in Milton's."
  - The live meta description cuts the generated sentence off after 'Milton's' and adds a period, leaving an ungrammatical fragment. The stored streetContent.metaDescription is also not what renders.
- **minor** · meta description (LIVE <meta name="description"> and og:description). The stored metaDescription is not used. · lenses physical+compliance
  - quote: "Jempson Path, Milton: 1 sale in the last 12 months on record, current listings, and the full street read. Jempson Path is a residential street in Milton's."
  - fitDescription cuts the generated first sentence at a word and leaves a dangling possessive, "in Milton's.", in the search snippet.

## Stored only, never served

### gowland-crescent-milton

- **compliance** · market (paragraph 2; also in streetContent.description) · lenses numeric+physical+compliance
  - quote: "On the rental side, three-bedroom homes on the street typically rent around $2,800 a month, drawn from a small pool of leases."
  - A point 'typical' rent is published from 2 leases. The k5 rule for a point typical is not met. With n=2 the median is the midpoint of two identifiable tenancies, so anyone who knows one rent can work out the other.
- **compliance** · faq Q7 (What's the rental market like on Gowland Crescent?) · lenses numeric+compliance
  - quote: "Three-bedroom leases on the crescent have been settling around $2,800."
  - The same sub-k5 point rent as the market section (n=2). 'Have been settling' also implies a trend over time that two leases cannot support.
- **fabrication** · amenities (paragraph 2) · lenses numeric
  - quote: "Sam Sherratt PS is a four-minute drive, and Anne J. MacArthur PS, Irma Coulson PS, and Robert Baldwin PS are each about five minutes out."
  - The travel mode is wrong. The 4 for Sam Sherratt PS is a walking figure, not a drive. The schools section and the FAQ call the same 4 minutes 'on foot', so the stored text contradicts itself.
- **fabrication** · neighbourhoodComparable (paragraph 1) · lenses numeric+physical+compliance
  - quote: "Across Timberlea, comparable detached homes have sold at broadly similar levels, and the neighbourhood read is the more reliable of the two scopes given how infrequently Gowland Crescent itself changes hands."
  - This compares against a street price the model was never given, so the similarity is invented. The page's own deterministic figure contradicts it.
- **fabrication** · homes · lenses numeric+physical
  - quote: "Across the wider Timberlea area, detached homes typically trade around $1.05M, a figure that situates this pocket in Milton's mid-tier detached market."
  - $1.05M is grounded. The town-wide rank 'mid-tier' has no grounding: the input carries no town-wide detached distribution.
- **misattribution** · differentPriorities; repeated in faq Q8 · lenses numeric
  - quote: "Fox Crescent, in Dempsey, carries detached homes trading around $1.15M, a step above the Timberlea detached band. Tupper Drive, in Clarke, runs to townhouse product trading around $975K, which trades space for a lower entry point."
  - Each comparator's all-property-type average is presented as the price of one property type ('detached homes', 'townhouse product'). The model copied distinctivePattern, but the input itself mislabels the figure.
- **fabrication** · differentPriorities · lenses numeric+physical
  - quote: "The difference is largely one of housing mix and price tier rather than location, since all three sit within a few minutes of the same highway and GO access."
  - This states travel-time proximity for Fox Crescent and Tupper Drive. The input carries no highway or GO distance for either comparator.
- **minor** · schools; also faq Q3; plus schools 'The cluster is tight enough that most of these are a short walk or a quick drive rather than a cross-town trip.' · lenses numeric
  - quote: "Sam Sherratt PS is the nearest Halton District School Board elementary, about four minutes on foot, with Anne J. MacArthur PS, Irma Coulson PS and Robert Baldwin PS each roughly five minutes away."
  - The input carries no travel mode, so 'on foot' was a guess. It happens to be right for Sam Sherratt PS, but the sentence goes on to present the other three 5-minute figures as if also on foot. Those are drives of 1.70–2.14 km (20–26 min on foot). Only 1 of the 8 listed schools is walkable.
- **minor** · amenities (paragraph 1) · lenses numeric+physical
  - quote: "Moorelands Park and Sam Sherratt Park are each roughly four minutes away, giving the immediate area an unusual density of green space for a residential pocket."
  - The 4-minute figures are grounded. The comparative 'unusual density' has no baseline in the input.
- **fabrication** · about (stored in StreetContent.description; dropped at render by the "a short walk" rule) · lenses physical
  - quote: "Sam Sherratt Trail Park is a short walk away, and the surrounding streets carry the quiet rhythm of a settled residential grid."
  - "quiet" and "settled" have no source, since the input has no traffic, noise or era data. "grid" contradicts Town data: Gowland is a one-connection crescent off Laurier Avenue, and Laurier feeds a curvilinear pattern of crescents and courts, not a grid.
- **misattribution** · amenities (stored only) · lenses physical
  - quote: "Sam Sherratt PS is a four-minute drive"
  - The 4 is walking minutes, not driving: the school is 0.36 km away. This contradicts the schools section and FAQ Q3, which both say "about four minutes on foot".
- **misattribution** · gettingAround (stored only) · lenses physical
  - quote: "Gowland Crescent sits in Timberlea, a position that makes the GO station the realistic Toronto commute; the walk to Milton GO Station runs about ten minutes, and from there the train and subway combination reaches downtown in roughly seventy minutes."
  - The input's 70 minutes is the whole door-to-downtown trip, including the 10-minute walk. The prose gives 70 to the rail leg alone, which implies an 80-minute trip. "subway" is not in the input, which says only TTC. FAQ Q4 states it correctly ("the full trip to downtown running roughly seventy minutes").
- **misattribution** · gettingAround (stored only), repeated in faq Q6 · lenses physical
  - quote: "The 401 onramp at James Snow Parkway is a five-minute drive, which puts Mississauga around twenty-two minutes and Oakville around twenty-four, with Burlington a touch closer at twenty."
  - The sentence credits this street's 401 access for the Mississauga, Oakville and Burlington times. In fact those times are fixed constants, identical on every Milton street, with no route behind them. The Pearson qualifiers "in typical traffic" and FAQ Q5 "keeps the airport run straightforward outside peak hours" also have no source, since the input has no traffic or peak data.
- **voice** · sectionsJson.market p1 (stored; the market section is not rendered) · lenses compliance
  - quote: "Suitability questions belong elsewhere on this page; the market read here is simply that Gowland Crescent is a low-turnover detached street whose pricing is clearest when read against the neighbourhood comparable."
  - A prompt instruction echoed into the copy. 'Days on market cannot be stated for the street itself, since the sale count falls below the threshold at which a pace figure becomes meaningful.' (market p0) and 'The street itself carries too few recent sales to publish its own range' (homes p0) are the same kind of methodology leak.

### ennisclare-drive-milton

- **misattribution** · about (sectionsJson about.paragraphs[0]) and StreetContent.description; related: homes 'The housing stock on Ennisclare Drive is detached' and 'The street reads as a small rural address rather than a developed residential run.' · lenses numeric+physical+compliance
  - quote: "The road carries a single detached home in the recent record, which tells you most of what you need to know about its scale."
  - The 12-month sale count (1) is presented as the number of homes on the road, and the road's scale is then inferred from it. The housing stock is also stated as all-detached on the strength of one sale. The input has no count of homes or addresses on the street, and the Town records 29 addresses along 1.3 km. The sentence is stored but stripped from the live page.
- **misattribution** · gettingAround (sectionsJson gettingAround.paragraphs[0]); stored only (stripped live) · lenses numeric+physical
  - quote: "The Milton GO Station is a twenty-eight minute drive, and from there the run downtown takes about eighty-eight minutes door to door."
  - 88 minutes is the TOTAL trip, including the 28-minute drive. 'From there' assigns all 88 minutes to the leg after the GO station, which implies about 116 minutes in total. The leg from the station is 60 minutes. The sentence also contradicts itself with 'door to door'. faq[4] states the figure correctly ('for a total of about eighty-eight minutes').
- **misattribution** · faq[5]; also gettingAround 'For points west and south, the arithmetic is friendlier: Mississauga is twenty-two minutes by car, Burlington twenty, Oakville twenty-four.' and 'Pearson is thirty-two minutes'; stored only · lenses numeric
  - quote: "Pearson is about thirty-two minutes by car from Ennisclare Drive."
  - These figures are fixed Milton-centroid constants that are the same for every street, but they are presented as times from this street. They do not fit the street's own geography: the same input puts Milton GO 28 minutes away, yet Burlington comes out at 20 and Mississauga at 22. Separately, 'points west and south' puts Mississauga (east of Milton) in the wrong direction, and no input field gives any direction.
- **misattribution** · homes (sectionsJson homes.paragraphs[0]); stored only · lenses numeric
  - quote: "For broader context, homes across the Rural Nassagaweya area typically trade around $1,550,000, though that is the neighbourhood's figure and not this street's."
  - The figure covers detached homes only, but the sentence presents it as the typical price for all 'homes across the Rural Nassagaweya area'. The value itself is right; the scope is not. The comparable section scopes it correctly ('for detached homes in Rural Nassagaweya').
- **minor** · about paragraphs[0]; stored only (dropped live by the coherence pass) · lenses numeric+physical
  - quote: "It is not a street you pass through on the way to somewhere else."
  - This through-traffic claim matches data the model never saw (a dead-end terminus). It is true, but unsupported by the input.
- **minor** · gettingAround paragraphs[0]; stored only · lenses numeric+physical
  - quote: "The Highway 401 onramp at Regional Road 25 is twenty-six minutes away, so the 401 is reached without threading through Milton's core."
  - The 26 minutes is supported by the input. The route claim ('without threading through Milton's core') is not: the input has no route data. The clause paraphrases the prompt's own example sentence.
- **minor** · faq[4] 'How far is Ennisclare Drive from Toronto?'; stored only · lenses numeric+physical
  - quote: "By car alone the trip is longer and traffic-dependent."
  - This compares against a drive-to-Toronto time that is not in the input. The only Toronto figure is the GO+TTC total.
- **minor** · faq[5]; stored only · lenses numeric
  - quote: "That keeps airport runs within a single sitting outside peak hours."
  - The 'outside peak hours' qualifier has no source; the input has no time-of-day or traffic data. The 32 minutes is a fixed constant (see the Pearson finding above), not an off-peak measurement.
- **fabrication** · homes (stored in sectionsJson and StreetContent.description; homes section not rendered live) · lenses physical
  - quote: "The street reads as a small rural address rather than a developed residential run."
  - Describes the street's size from one sale. The model had no dwelling count. Town data contradicts it: 29 civic addresses along a 1.3 km local road is a developed residential run.
- **fabrication** · gettingAround (stored in sectionsJson and StreetContent.description; section not rendered live) · lenses physical
  - quote: "For points west and south, the arithmetic is friendlier: Mississauga is twenty-two minutes by car, Burlington twenty, Oakville twenty-four."
  - Made-up direction, and wrong: Mississauga is east of the street and Oakville is southeast. The input has no direction for any destination.
- **compliance** · rendered page, Address ladder (AddressLadder.tsx via src/lib/streetAddresses.ts buildAddressLadder) plus the sales tiles · lenses compliance
  - quote: "4220 | data-d="two thirds along · even side · Detached · 0.73" (the only ladder mark besides the live 4215 that carries a building form), shown beside "Detached sold 1 / 1 sale · last 12 months" and "Recent sales · last 90 days 1"
  - The ladder's 'Detached' label for 4220 comes from a sold listing. The page also tells logged-out visitors that one detached home on the street sold in the last 90 days, so anyone can work out that 4220 Ennisclare Drive is the sold home and roughly when it sold. No price and no exact date appear, but the address of a sold listing is VOW data. It also breaks the module's own rule: 'NEVER, AT ANY k: ... a historical listing'.
- **misattribution** · rendered page, 'Around Ennisclare Drive' Schools cards · lenses compliance
  - quote: "Around Ennisclare Drive | Schools: Chris Hadfield PS / Anne J. MacArthur PS / Irma Coulson PS / E.W. Foster PS (Halton District School Board · Elementary)"
  - The heading says these are the schools around this street, but they are just the first four schools in the roster. The nearest school in the input, Brookville ES at 8 minutes, is not listed.
- **minor** · rendered 'Commute & reach' Places of worship block (template); stored amenities p1 worship sentence names only the two mosques (not rendered) · lenses compliance
  - quote: "Places of worship / Mosques, churches, gurdwaras / Halton Islamic Community Centre 36 min drive / Milton Muslim Community Centre 26 min drive / Islamic Community Centre of Milton 21 min drive"
  - The subtitle promises churches and gurdwaras, but the block lists only mosques. Presenting a single faith's institutions as 'places of worship' on a street page is a fair-housing register risk, even though the distances are grounded.
- **voice** · stored schools p0 and FAQ 6 (also in StreetContent.faqJson); not rendered · lenses compliance
  - quote: "Bishop P.F. Reding Catholic SS is the nearest secondary named here | The 407 is not named in the data for this street."
  - The phrasing talks about the pipeline itself ('named here', 'not named in the data'). That is methodology language in reader-facing text. It is stored in the dual-write row, but the strip currently hides it.

### jempson-path-milton

- **misattribution** · market (sectionsJson + streetContent.description; stored only, numeric sentence stripped at render) · lenses numeric+physical+compliance
  - quote: "For orientation, homes across Harrison typically trade around $750,000, a figure that describes the neighbourhood rather than this street."
  - The only $750K figure in the input is a townhouse-only comparable, but this sentence gives it as the typical for all homes across Harrison. The live page's own deterministic block says the Harrison typical for all homes is $900K. The homes section gets the scope right ('townhomes typically trade around $750,000').
- **fabrication** · gettingAround (stored only; numeric sentence stripped at render) · lenses numeric+physical+compliance
  - quote: "Oakville and Burlington sit 24 and 20 minutes out respectively, both westbound runs that rarely demand the highway."
  - The minutes are grounded, but the direction and route are invented and wrong. From the street centroid (43.4849, -79.8711), Oakville lies east-southeast and Burlington south-southeast, so neither trip is westbound. Nothing in the input covers routes or highway use.
- **fabrication** · faq[6] (stored only; dropped at render) · lenses numeric+physical+compliance
  - quote: "The 407 is not the natural approach from this position."
  - This is a claim about Highway 407 access, and the input has no 407 data at all. The FAQ bank forces a '401 or 407' question, so the 407 half of the answer can only be made up.
- **minor** · schools (stored only; section not rendered) · lenses numeric+physical+compliance
  - quote: "P.L. Robertson PS is the closest Halton District School Board elementary, three minutes by car, with Tiger Jeet Singh PS a further six."
  - There are two numeric errors here. (1) The 3 is a walking time, not a drive: the builder uses walk minutes when a school is under 1.5 km, and this school is about 0.29 km away. The amenities section of the same stored text says 'P.L. Robertson Public School is a three-minute walk'. (2) 'A further six' reads as six more minutes, about 9 in total, but the input value is 6 in total.
- **minor** · neighbourhoodComparable (stored only; numeric sentence stripped at render) · lenses numeric+physical
  - quote: "Pace across the neighbourhood runs at a moderate tempo, with comparable homes typically clearing in around 86 days, a cadence that reflects a market where well-prepared listings move and others wait."
  - 86 days is grounded. 'Moderate tempo' is a comparison with no comparator in the input: the street's own DOM is null and there is no town-wide figure. The page's own Market watch shows urban Milton at 28 days, which makes 86 about three times slower. 'Well-prepared listings move and others wait' is also invented.
- **minor** · about (stored only); also gettingAround 'For a street this size' · lenses numeric+physical+compliance
  - quote: "This is a quieter, low-turnover address rather than a through-route"
  - The road class ('rather than a through-route') and street size ('a street this size') appear only in streetGeometry.ts (local road, lengthM 80). They are not in inputJson, so the model had no source for them, even though they are true.
- **fabrication** · gettingAround (stored only, not rendered) · lenses physical
  - quote: "For a street this size, the reach is broader than the address suggests: one short drive covers the train, the highway and the airport."
  - "a street this size" refers to a physical size the model was never given. The street is in fact 80 m, but that length is only in streetGeometry.ts, so the model could not know it. "one short drive covers ... the airport" also overstates: Pearson is 32 minutes, four times the 8-minute GO and 401 figures it is grouped with.

## Refuted by the skeptics (not findings)

- gowland-crescent-milton · numeric · "Gowland Crescent trades rarely, and the record over the past year is thin enough that no street-level price range can be published with conf"
- gowland-crescent-milton · numeric · "The 401 onramp at James Snow Parkway is a five-minute drive, which puts Mississauga around twenty-two minutes and Oakville around twenty-fou"
- gowland-crescent-milton · numeric · "Sold-to-ask sits just below parity, which implies a market where modest negotiation is normal and buyers are not routinely paying above aski"
- gowland-crescent-milton · numeric · "Sam Sherratt Trail Park is under a minute's walk, and Beaver Court Park follows at about two minutes on foot."
- gowland-crescent-milton · numeric · "and Bishop P.F. Reding Catholic SS is the closest secondary option at a similar distance"
- gowland-crescent-milton · numeric · "Neighbourhood-wide, comparable detached homes typically clear in around 89 days, a pace that reflects a measured market rather than a rushed"
- gowland-crescent-milton · numeric · "There is no townhouse or semi-detached product mixed in. The detached profile is consistent across the crescent."
- gowland-crescent-milton · physical · "The rental profile tracks the detached stock rather than a condo market."
- gowland-crescent-milton · physical · "Gowland Crescent trades rarely, and the record over the past year is thin enough that no street-level price range can be published with conf"
- gowland-crescent-milton · physical · "On the Catholic side, Guardian Angels Catholic ES, Holy Rosary Catholic ES and St. Anthony of Padua Catholic ES all sit about five minutes b"
- gowland-crescent-milton · compliance · "The clearest pricing reference for Gowland Crescent is therefore the wider Timberlea neighbourhood, where comparable detached homes have bee"
- gowland-crescent-milton · compliance · "Sam Sherratt PS is the nearest Halton District School Board elementary, about four minutes on foot"
- gowland-crescent-milton · compliance · "A reliable street-level price is not available given the thin recent activity on Gowland Crescent."
- gowland-crescent-milton · compliance · "Gowland Crescent, Milton: homes typically $1,300,000 across 7 sales in the last ~2 years. Gowland Crescent is a residential curve in Milton'"
- gowland-crescent-milton · compliance · "Contains information licensed under the Open Government Licence – Milton."
- gowland-crescent-milton · compliance · "Typical rent —"
- ennisclare-drive-milton · numeric · "Across Rural Nassagaweya, detached homes comparable to those on Ennisclare Drive have sold at broadly comparable levels over the past year, "
- ennisclare-drive-milton · physical · "The street's recorded stock is detached housing."
- ennisclare-drive-milton · physical · "Pearson is about thirty-two minutes by car from Ennisclare Drive. That keeps airport runs within a single sitting outside peak hours."
- ennisclare-drive-milton · physical · "Across Rural Nassagaweya, detached homes comparable to those on Ennisclare Drive have sold at broadly comparable levels over the past year, "
- ennisclare-drive-milton · physical · "Suitability for this street is therefore a question of fit rather than of price benchmarking, and the sections that follow carry that discus"
- ennisclare-drive-milton · physical · "For broader context, homes across the Rural Nassagaweya area typically trade around $1,550,000, though that is the neighbourhood's figure an"
- ennisclare-drive-milton · compliance · "Suitability for this street is therefore a question of fit rather than of price benchmarking, and the sections that follow carry that discus"
- ennisclare-drive-milton · compliance · "Typical sold — | Days on market · last 12 months — | X—"
- ennisclare-drive-milton · compliance · "Contains information licensed under the Open Government Licence – Milton."
- ennisclare-drive-milton · compliance · "Most for sale right now | Most for rent right now | Most sales in Nassagaweya, last 12 months | Most sales, last 12 months | Busiest streets"
- ennisclare-drive-milton · compliance · "Street Profile · Rural Nassagaweya · Milton, ON vs the typical home price across Nassagaweya"
- jempson-path-milton · numeric · "The 401 onramp at Regional Rd 25 is the same eight minutes by car, which puts Mississauga within about 22 minutes and Pearson around 32."
- jempson-path-milton · numeric · "Jempson Path trades rarely."
- jempson-path-milton · numeric · "gives a reader the clearest sense of where values sit for homes of this type in Harrison"
- jempson-path-milton · physical · "The housing stock is townhouse, and the one active listing currently on the street sits within that same form."
- jempson-path-milton · physical · "The 401 onramp at Regional Rd 25 is the same eight minutes by car, which puts Mississauga within about 22 minutes and Pearson around 32."
- jempson-path-milton · physical · "Jempson Path trades rarely."
- jempson-path-milton · physical · "The street is townhouse in form, and that is the only housing type recorded here. The mix is uniform rather than varied."
- jempson-path-milton · physical · "gives a reader the clearest sense of where values sit for homes of this type in Harrison"
- jempson-path-milton · compliance · "it is that wider pattern, not the street's own sparse record, that gives a reader the clearest sense of where values sit for homes of this t"
- jempson-path-milton · compliance · "The street is townhouse in form, and that is the only housing type recorded here. The mix is uniform rather than varied."
- jempson-path-milton · compliance · "Readers weighing Jempson Path against other Milton streets should treat the neighbourhood comparable as the working reference and the street"
- jempson-path-milton · compliance · "P.L. Robertson Public School is a three-minute walk, and St. Scholastica Catholic Elementary is about four minutes away."
- jempson-path-milton · compliance · "The typical sold price for townhouse stock in the neighbourhood sits near $750,000, drawn from a full sample of recent sales rather than a h"
- jempson-path-milton · compliance · "Contains information licensed under the Open Government Licence – Milton."
