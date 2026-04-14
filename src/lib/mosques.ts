export type MosqueType = "masjid" | "musalla" | "centre";

export interface Mosque {
  slug: string;
  name: string;
  address: string;
  affiliation: string;
  type: MosqueType;
  services: string[];
  neighbourhood: string;
  notes: string | null;
}

export const mosques: Mosque[] = [
  {
    slug: "halton-islamic-community-centre",
    name: "Halton Islamic Community Centre",
    address: "4269 Regional Rd 25, Milton",
    affiliation: "Muslim Association of Milton",
    type: "masjid",
    services: ["Daily prayers", "Jumu'ah", "Islamic school", "Hifz program", "Food bank"],
    neighbourhood: "Milton",
    notes: "Full masjid — Milton's largest Islamic centre with daily prayers, education programs, and community services",
  },
  {
    slug: "halton-learning-centre-musalla",
    name: "Halton Learning Centre Musalla",
    address: "550 Ontario St S, Milton",
    affiliation: "Muslim Association of Milton",
    type: "musalla",
    services: ["Community programs"],
    neighbourhood: "Milton",
    notes: "Musalla and community learning centre operated by the Muslim Association of Milton",
  },
  {
    slug: "milton-muslim-community-centre",
    name: "Milton Muslim Community Centre",
    address: "50 Steeles Ave E, Units 212–213 & 1145 Bronte St S, Milton",
    affiliation: "Minhaj-ul-Quran",
    type: "centre",
    services: ["Daily prayers", "Jumu'ah"],
    neighbourhood: "Milton",
    notes: "Operated by Minhaj-ul-Quran with two Milton locations",
  },
  {
    slug: "islamic-community-centre-of-milton",
    name: "Islamic Community Centre of Milton",
    address: "8069 Esquesing Line, Milton",
    affiliation: "Sunni",
    type: "masjid",
    services: ["Daily prayers", "Jumu'ah"],
    neighbourhood: "Milton",
    notes: null,
  },
  {
    slug: "sayyidah-fatemah-islamic-centre",
    name: "Sayyidah Fatemah Islamic Centre",
    address: "Milton",
    affiliation: "Islamic Supreme Council of Canada",
    type: "centre",
    services: ["Daily prayers", "Jumu'ah"],
    neighbourhood: "Milton",
    notes: "Founded by the Islamic Supreme Council of Canada",
  },
  {
    slug: "icna-milton",
    name: "ICNA Milton",
    address: "500 Laurier Ave, Unit 15, Milton",
    affiliation: "ICNA",
    type: "centre",
    services: ["Daily prayers", "Jumu'ah"],
    neighbourhood: "Milton",
    notes: null,
  },
  {
    slug: "milton-musalla",
    name: "Milton Musalla",
    address: "6521 Derry Rd W, Unit 4, Milton",
    affiliation: "Independent",
    type: "musalla",
    services: ["Prayer space"],
    neighbourhood: "Milton",
    notes: "Neighbourhood prayer space in northwest Milton",
  },
];

export function getMosqueBySlug(slug: string): Mosque | undefined {
  return mosques.find((m) => m.slug === slug);
}

export function getMosquesByNeighbourhood(neighbourhood: string): Mosque[] {
  return mosques.filter((m) => m.neighbourhood.toLowerCase() === neighbourhood.toLowerCase());
}

export function getAllMosqueNeighbourhoods(): string[] {
  return Array.from(new Set(mosques.map((m) => m.neighbourhood))).sort();
}
