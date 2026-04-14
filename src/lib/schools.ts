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
}

export const schools: School[] = [
  // ── PUBLIC ELEMENTARY (Halton District School Board) ──
  { slug: "chris-hadfield-ps", name: "Chris Hadfield PS", board: "public", level: "elementary", boardName: "Halton District School Board", grades: "JK–8", neighbourhood: "Dempsey", notes: null, fraserScore: null },
  { slug: "anne-j-macarthur-ps", name: "Anne J. MacArthur PS", board: "public", level: "elementary", boardName: "Halton District School Board", grades: "JK–8", neighbourhood: "Hawthorne Village", notes: null, fraserScore: null },
  { slug: "irma-coulson-ps", name: "Irma Coulson PS", board: "public", level: "elementary", boardName: "Halton District School Board", grades: "JK–8", neighbourhood: "Beaty", notes: null, fraserScore: null },
  { slug: "ew-foster-ps", name: "E.W. Foster PS", board: "public", level: "elementary", boardName: "Halton District School Board", grades: "JK–5", neighbourhood: "Timberlea", notes: null, fraserScore: null },
  { slug: "tiger-jeet-singh-ps", name: "Tiger Jeet Singh PS", board: "public", level: "elementary", boardName: "Halton District School Board", grades: "JK–8", neighbourhood: "Milton", notes: null, fraserScore: null },
  { slug: "pl-robertson-ps", name: "P.L. Robertson PS", board: "public", level: "elementary", boardName: "Halton District School Board", grades: "JK–8", neighbourhood: "Milton", notes: null, fraserScore: null },
  { slug: "robert-baldwin-ps", name: "Robert Baldwin PS", board: "public", level: "elementary", boardName: "Halton District School Board", grades: "JK–8", neighbourhood: "Old Milton", notes: null, fraserScore: null },
  { slug: "brookville-es", name: "Brookville ES", board: "public", level: "elementary", boardName: "Halton District School Board", grades: "JK–8", neighbourhood: "Campbellville", notes: null, fraserScore: null },
  { slug: "sam-sherratt-ps", name: "Sam Sherratt PS", board: "public", level: "elementary", boardName: "Halton District School Board", grades: "6–8", neighbourhood: "Timberlea", notes: null, fraserScore: null },
  { slug: "wi-dick-middle-school", name: "W.I. Dick Middle School", board: "public", level: "elementary", boardName: "Halton District School Board", grades: "6–8", neighbourhood: "Timberlea", notes: "French Immersion", fraserScore: null },

  // ── PUBLIC SECONDARY (Halton District School Board) ──
  { slug: "milton-district-high-school", name: "Milton District High School", board: "public", level: "secondary", boardName: "Halton District School Board", grades: "9–12", neighbourhood: "Milton", notes: null, fraserScore: "7.7" },
  { slug: "elsie-macgill-secondary-school", name: "Elsie MacGill Secondary School", board: "public", level: "secondary", boardName: "Halton District School Board", grades: "9–12", neighbourhood: "Milton", notes: "Opened 2022, I-STEM focus", fraserScore: null },
  { slug: "ec-drury-school-for-the-deaf", name: "E.C. Drury School for the Deaf", board: "public", level: "secondary", boardName: "Halton District School Board", grades: "JK–12", neighbourhood: "Milton", notes: "Provincial school, special education", fraserScore: null },

  // ── CATHOLIC ELEMENTARY (Halton Catholic District School Board) ──
  { slug: "our-lady-of-fatima-catholic-es", name: "Our Lady of Fatima Catholic ES", board: "catholic", level: "elementary", boardName: "Halton Catholic District School Board", grades: "JK–8", neighbourhood: "Milton", notes: null, fraserScore: null },
  { slug: "guardian-angels-catholic-es", name: "Guardian Angels Catholic ES", board: "catholic", level: "elementary", boardName: "Halton Catholic District School Board", grades: "JK–8", neighbourhood: "Milton", notes: null, fraserScore: null },
  { slug: "holy-rosary-catholic-es", name: "Holy Rosary Catholic ES", board: "catholic", level: "elementary", boardName: "Halton Catholic District School Board", grades: "JK–8", neighbourhood: "Milton", notes: null, fraserScore: null },
  { slug: "st-scholastica-catholic-es", name: "St. Scholastica Catholic ES", board: "catholic", level: "elementary", boardName: "Halton Catholic District School Board", grades: "JK–8", neighbourhood: "Milton", notes: null, fraserScore: null },
  { slug: "st-anthony-of-padua-catholic-es", name: "St. Anthony of Padua Catholic ES", board: "catholic", level: "elementary", boardName: "Halton Catholic District School Board", grades: "JK–8", neighbourhood: "Milton", notes: null, fraserScore: null },
  { slug: "st-peter-catholic-es", name: "St. Peter Catholic ES", board: "catholic", level: "elementary", boardName: "Halton Catholic District School Board", grades: "JK–8", neighbourhood: "Milton", notes: null, fraserScore: null },
  { slug: "st-brigid-catholic-es", name: "St. Brigid Catholic ES", board: "catholic", level: "elementary", boardName: "Halton Catholic District School Board", grades: "JK–8", neighbourhood: "Milton", notes: null, fraserScore: null },
  { slug: "st-catherine-of-alexandria-catholic-es", name: "St. Catherine of Alexandria Catholic ES", board: "catholic", level: "elementary", boardName: "Halton Catholic District School Board", grades: "JK–8", neighbourhood: "Milton", notes: null, fraserScore: null },
  { slug: "st-francis-of-assisi-catholic-es", name: "St. Francis of Assisi Catholic ES", board: "catholic", level: "elementary", boardName: "Halton Catholic District School Board", grades: "JK–8", neighbourhood: "Milton", notes: null, fraserScore: null },
  { slug: "st-joseph-catholic-es", name: "St. Joseph Catholic ES", board: "catholic", level: "elementary", boardName: "Halton Catholic District School Board", grades: "JK–8", neighbourhood: "Milton", notes: null, fraserScore: null },
  { slug: "st-anne-catholic-es", name: "St. Anne Catholic ES", board: "catholic", level: "elementary", boardName: "Halton Catholic District School Board", grades: "JK–8", neighbourhood: "Milton", notes: null, fraserScore: null },
  { slug: "st-john-paul-ii-catholic-es", name: "St. John Paul II Catholic ES", board: "catholic", level: "elementary", boardName: "Halton Catholic District School Board", grades: "JK–8", neighbourhood: "Milton", notes: null, fraserScore: null },

  // ── CATHOLIC SECONDARY (Halton Catholic District School Board) ──
  { slug: "bishop-pf-reding-catholic-ss", name: "Bishop P.F. Reding Catholic SS", board: "catholic", level: "secondary", boardName: "Halton Catholic District School Board", grades: "9–12", neighbourhood: "Milton", notes: "Top in Milton", fraserScore: "8.0–8.2" },
  { slug: "st-francis-xavier-catholic-ss", name: "St. Francis Xavier Catholic SS", board: "catholic", level: "secondary", boardName: "Halton Catholic District School Board", grades: "9–12", neighbourhood: "Milton", notes: "Strong co-curricular", fraserScore: null },
  { slug: "st-kateri-tekakwitha-catholic-ss", name: "St. Kateri Tekakwitha Catholic SS", board: "catholic", level: "secondary", boardName: "Halton Catholic District School Board", grades: "9–12", neighbourhood: "Milton", notes: "Newer school", fraserScore: null },
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
