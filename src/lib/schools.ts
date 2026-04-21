export type Board = "public" | "catholic";
export type Level = "elementary" | "secondary";

export interface School {
  slug: string;
  name: string;
  board: Board;
  level: Level;
  boardName: string;
  grades: string;
  neighbourhood: string;
  notes: string | null;
  fraserScore: string | null;
  /** Optional coordinates. Populated for the major Milton schools via
   *  neighbourhood centroid or known landmark address. When present, enables
   *  real haversine distance from a street centroid; when absent, callers
   *  should surface distance as null rather than invent a number. */
  lat?: number;
  lng?: number;
}

export const schools: School[] = [
  // ── PUBLIC ELEMENTARY (Halton District School Board) ──
  // lat/lng populated via neighbourhood centroid (approximate, ±300m) for
  // schools whose neighbourhood field is specific enough to anchor. Schools
  // in the generic "Milton" catchment are populated only where a landmark
  // address is widely known; the rest stay without coords.
  { slug: "chris-hadfield-ps", name: "Chris Hadfield PS", board: "public", level: "elementary", boardName: "Halton District School Board", grades: "JK–8", neighbourhood: "Dempsey", notes: null, fraserScore: null, lat: 43.5250, lng: -79.8700 },
  { slug: "anne-j-macarthur-ps", name: "Anne J. MacArthur PS", board: "public", level: "elementary", boardName: "Halton District School Board", grades: "JK–8", neighbourhood: "Hawthorne Village", notes: null, fraserScore: null, lat: 43.5400, lng: -79.8850 },
  { slug: "irma-coulson-ps", name: "Irma Coulson PS", board: "public", level: "elementary", boardName: "Halton District School Board", grades: "JK–8", neighbourhood: "Beaty", notes: null, fraserScore: null, lat: 43.5280, lng: -79.8750 },
  { slug: "ew-foster-ps", name: "E.W. Foster PS", board: "public", level: "elementary", boardName: "Halton District School Board", grades: "JK–5", neighbourhood: "Timberlea", notes: null, fraserScore: null, lat: 43.5050, lng: -79.8950 },
  { slug: "tiger-jeet-singh-ps", name: "Tiger Jeet Singh PS", board: "public", level: "elementary", boardName: "Halton District School Board", grades: "JK–8", neighbourhood: "Milton", notes: null, fraserScore: null, lat: 43.5070, lng: -79.8680 },
  { slug: "pl-robertson-ps", name: "P.L. Robertson PS", board: "public", level: "elementary", boardName: "Halton District School Board", grades: "JK–8", neighbourhood: "Milton", notes: null, fraserScore: null },
  { slug: "robert-baldwin-ps", name: "Robert Baldwin PS", board: "public", level: "elementary", boardName: "Halton District School Board", grades: "JK–8", neighbourhood: "Old Milton", notes: null, fraserScore: null, lat: 43.5150, lng: -79.8830 },
  { slug: "brookville-es", name: "Brookville ES", board: "public", level: "elementary", boardName: "Halton District School Board", grades: "JK–8", neighbourhood: "Campbellville", notes: null, fraserScore: null, lat: 43.4700, lng: -79.9900 },
  { slug: "sam-sherratt-ps", name: "Sam Sherratt PS", board: "public", level: "elementary", boardName: "Halton District School Board", grades: "6–8", neighbourhood: "Timberlea", notes: null, fraserScore: null, lat: 43.5130, lng: -79.8930 },
  { slug: "wi-dick-middle-school", name: "W.I. Dick Middle School", board: "public", level: "elementary", boardName: "Halton District School Board", grades: "6–8", neighbourhood: "Timberlea", notes: "French Immersion", fraserScore: null, lat: 43.5050, lng: -79.8950 },

  // ── PUBLIC SECONDARY (Halton District School Board) ──
  { slug: "milton-district-high-school", name: "Milton District High School", board: "public", level: "secondary", boardName: "Halton District School Board", grades: "9–12", neighbourhood: "Milton", notes: null, fraserScore: "7.7", lat: 43.5160, lng: -79.8800 },
  { slug: "elsie-macgill-secondary-school", name: "Elsie MacGill Secondary School", board: "public", level: "secondary", boardName: "Halton District School Board", grades: "9–12", neighbourhood: "Milton", notes: "Opened 2022, I-STEM focus", fraserScore: null, lat: 43.5280, lng: -79.8450 },
  { slug: "craig-kielburger-ss", name: "Craig Kielburger SS", board: "public", level: "secondary", boardName: "Halton District School Board", grades: "9–12", neighbourhood: "Willmott", notes: null, fraserScore: null, lat: 43.4990, lng: -79.9080 },
  { slug: "ec-drury-school-for-the-deaf", name: "E.C. Drury School for the Deaf", board: "public", level: "secondary", boardName: "Halton District School Board", grades: "JK–12", neighbourhood: "Milton", notes: "Provincial school, special education", fraserScore: null },

  // ── CATHOLIC ELEMENTARY (Halton Catholic District School Board) ──
  { slug: "our-lady-of-fatima-catholic-es", name: "Our Lady of Fatima Catholic ES", board: "catholic", level: "elementary", boardName: "Halton Catholic District School Board", grades: "JK–8", neighbourhood: "Milton", notes: null, fraserScore: null, lat: 43.5080, lng: -79.8720 },
  { slug: "guardian-angels-catholic-es", name: "Guardian Angels Catholic ES", board: "catholic", level: "elementary", boardName: "Halton Catholic District School Board", grades: "JK–8", neighbourhood: "Milton", notes: null, fraserScore: null, lat: 43.5180, lng: -79.8860 },
  { slug: "holy-rosary-catholic-es", name: "Holy Rosary Catholic ES", board: "catholic", level: "elementary", boardName: "Halton Catholic District School Board", grades: "JK–8", neighbourhood: "Milton", notes: null, fraserScore: null },
  { slug: "st-scholastica-catholic-es", name: "St. Scholastica Catholic ES", board: "catholic", level: "elementary", boardName: "Halton Catholic District School Board", grades: "JK–8", neighbourhood: "Milton", notes: null, fraserScore: null, lat: 43.4980, lng: -79.9070 },
  { slug: "st-anthony-of-padua-catholic-es", name: "St. Anthony of Padua Catholic ES", board: "catholic", level: "elementary", boardName: "Halton Catholic District School Board", grades: "JK–8", neighbourhood: "Milton", notes: null, fraserScore: null },
  { slug: "st-peter-catholic-es", name: "St. Peter Catholic ES", board: "catholic", level: "elementary", boardName: "Halton Catholic District School Board", grades: "JK–8", neighbourhood: "Milton", notes: null, fraserScore: null },
  { slug: "st-brigid-catholic-es", name: "St. Brigid Catholic ES", board: "catholic", level: "elementary", boardName: "Halton Catholic District School Board", grades: "JK–8", neighbourhood: "Milton", notes: null, fraserScore: null },
  { slug: "st-catherine-of-alexandria-catholic-es", name: "St. Catherine of Alexandria Catholic ES", board: "catholic", level: "elementary", boardName: "Halton Catholic District School Board", grades: "JK–8", neighbourhood: "Milton", notes: null, fraserScore: null },
  { slug: "st-francis-of-assisi-catholic-es", name: "St. Francis of Assisi Catholic ES", board: "catholic", level: "elementary", boardName: "Halton Catholic District School Board", grades: "JK–8", neighbourhood: "Milton", notes: null, fraserScore: null },
  { slug: "st-joseph-catholic-es", name: "St. Joseph Catholic ES", board: "catholic", level: "elementary", boardName: "Halton Catholic District School Board", grades: "JK–8", neighbourhood: "Milton", notes: null, fraserScore: null },
  { slug: "st-anne-catholic-es", name: "St. Anne Catholic ES", board: "catholic", level: "elementary", boardName: "Halton Catholic District School Board", grades: "JK–8", neighbourhood: "Milton", notes: null, fraserScore: null },
  { slug: "st-john-paul-ii-catholic-es", name: "St. John Paul II Catholic ES", board: "catholic", level: "elementary", boardName: "Halton Catholic District School Board", grades: "JK–8", neighbourhood: "Milton", notes: null, fraserScore: null },

  // ── CATHOLIC SECONDARY (Halton Catholic District School Board) ──
  { slug: "bishop-pf-reding-catholic-ss", name: "Bishop P.F. Reding Catholic SS", board: "catholic", level: "secondary", boardName: "Halton Catholic District School Board", grades: "9–12", neighbourhood: "Milton", notes: "Top in Milton", fraserScore: "8.0–8.2", lat: 43.5170, lng: -79.8740 },
  { slug: "st-francis-xavier-catholic-ss", name: "St. Francis Xavier Catholic SS", board: "catholic", level: "secondary", boardName: "Halton Catholic District School Board", grades: "9–12", neighbourhood: "Milton", notes: "Strong co-curricular", fraserScore: null, lat: 43.5050, lng: -79.8860 },
  { slug: "st-kateri-tekakwitha-catholic-ss", name: "St. Kateri Tekakwitha Catholic SS", board: "catholic", level: "secondary", boardName: "Halton Catholic District School Board", grades: "9–12", neighbourhood: "Milton", notes: "Newer school", fraserScore: null, lat: 43.4880, lng: -79.9180 },
];

export function getSchoolBySlug(slug: string): School | undefined {
  return schools.find((s) => s.slug === slug);
}

export function getSchoolsByNeighbourhood(neighbourhood: string): School[] {
  return schools.filter((s) => s.neighbourhood.toLowerCase() === neighbourhood.toLowerCase());
}

export function getSchoolsByBoard(board: Board): School[] {
  return schools.filter((s) => s.board === board);
}

export function getSchoolsByLevel(level: Level): School[] {
  return schools.filter((s) => s.level === level);
}

export function getAllNeighbourhoods(): string[] {
  return Array.from(new Set(schools.map((s) => s.neighbourhood))).sort();
}
