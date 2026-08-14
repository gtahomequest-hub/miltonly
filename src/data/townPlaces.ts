// src/data/townPlaces.ts
// GENERATED — do not hand-edit. Re-run: npx tsx scripts/town/gen-places.ts
//
// Source : Town of Milton Schools (https://api.milton.ca/arcgis/rest/services/Datasets/Schools/MapServer/0)
//          Town of Milton Parks   (https://api.milton.ca/arcgis/rest/services/Datasets/Parks/MapServer/0)
// Pulled : 2026-08-14
// Rows   : 36 school points · 93 park polygons (area-weighted centroids)
//
// Contains information licensed under the Open Government Licence – Milton.
//
// These REPLACE hand-entered coordinates. A distance is only as good as both of its endpoints:
// computing one from an authoritative street centroid to a "±300m via neighbourhood centroid"
// school would publish a precise number to an approximate place.

export interface TownPlace {
  name: string;
  lat: number;
  lng: number;
  address: string;
}

export interface TownSchool extends TownPlace {
  /** PUBLIC SCHOOL | CATHOLIC SCHOOL | … as the Town classifies it */
  type: string;
}

export interface TownPark extends TownPlace {
  /** VILLAGE | NEIGHBOURHOOD | DISTRICT | … */
  classification: string;
}

export const TOWN_SCHOOLS: readonly TownSchool[] = [
  { name: "Anne J Macarthur", type: "PUBLIC SCHOOL", address: "820 Farmstead Drive", lat: 43.495951, lng: -79.861385 },
  { name: "Bishop P. F. Reding", type: "SECONDARY SCHOOL", address: "1120 Main St E", lat: 43.530845, lng: -79.862264 },
  { name: "Boyne", type: "PUBLIC SCHOOL", address: "1110 Farmstead Drive", lat: 43.490496, lng: -79.853809 },
  { name: "Brookville", type: "PUBLIC SCHOOL", address: "11325 Guelph Line", lat: 43.533868, lng: -80.046864 },
  { name: "Bruce Trail", type: "PUBLIC SCHOOL", address: "1199 Costigan Rd", lat: 43.523068, lng: -79.850223 },
  { name: "Chris Hadfield", type: "PUBLIC SCHOOL", address: "1114 Woodward Ave", lat: 43.535117, lng: -79.867858 },
  { name: "Craig Kielburger", type: "SECONDARY SCHOOL", address: "1151 Ferguson Drive", lat: 43.514077, lng: -79.827064 },
  { name: "E.C. Drury School For The Deaf", type: "PROVINCIAL SCHOOL", address: "215 Ontario Street South", lat: 43.513304, lng: -79.867749 },
  { name: "E.W Foster", type: "PUBLIC SCHOOL", address: "320 Coxe Blvd", lat: 43.519859, lng: -79.861649 },
  { name: "Ecole St-Nicolas", type: "CATHOLIC SCHOOL", address: "720 Woodward Avenue", lat: 43.528243, lng: -79.87684 },
  { name: "Elsie Macgill", type: "SECONDARY SCHOOL", address: "1410 Bronte Street S", lat: 43.479689, lng: -79.851183 },
  { name: "Escarpment View", type: "PUBLIC SCHOOL", address: "351 Scott Blvd", lat: 43.497757, lng: -79.881109 },
  { name: "Guardian Angels", type: "CATHOLIC SCHOOL", address: "650 Bennett Blvd", lat: 43.518423, lng: -79.843462 },
  { name: "Hawthorne Village", type: "PUBLIC SCHOOL", address: "850 Bennet Blvd", lat: 43.514188, lng: -79.838113 },
  { name: "Holy Rosary Milton", type: "CATHOLIC SCHOOL", address: "141 Martin St", lat: 43.517429, lng: -79.885844 },
  { name: "Irma Coulson", type: "PUBLIC SCHOOL", address: "625 Sauve Street", lat: 43.523208, lng: -79.842177 },
  { name: "J.M. Denyes", type: "PUBLIC SCHOOL", address: "215 Thomas St", lat: 43.509626, lng: -79.876903 },
  { name: "Lumen Christi", type: "CATHOLIC SCHOOL", address: "841 Savoline Boulevard", lat: 43.485325, lng: -79.874063 },
  { name: "Martin Street", type: "PUBLIC SCHOOL", address: "184 Martin St", lat: 43.516437, lng: -79.888467 },
  { name: "Milton District High School", type: "SECONDARY SCHOOL", address: "396 Williams Ave", lat: 43.505842, lng: -79.870409 },
  { name: "Our Lady Of Fatima", type: "CATHOLIC SCHOOL", address: "709 Bolingbroke Dr", lat: 43.505649, lng: -79.849123 },
  { name: "Our Lady Of Victory", type: "CATHOLIC SCHOOL", address: "540 Commercial St", lat: 43.503702, lng: -79.867449 },
  { name: "P.L. Robertson", type: "PUBLIC SCHOOL", address: "840 Scott Blvd", lat: 43.487484, lng: -79.870697 },
  { name: "Queen Of Heaven", type: "CATHOLIC SCHOOL", address: "311 Savoline Boulevard", lat: 43.494994, lng: -79.888299 },
  { name: "Rattlesnake Point Public School", type: "PUBLIC SCHOOL", address: "1385 Kovachik Blvd", lat: 43.473305, lng: -79.860006 },
  { name: "Robert Baldwin", type: "PUBLIC SCHOOL", address: "180 Wilson Dr", lat: 43.526168, lng: -79.877647 },
  { name: "Sam Sherratt", type: "PUBLIC SCHOOL", address: "649 Laurier Ave", lat: 43.513802, lng: -79.860422 },
  { name: "St. Anthony Of Padua", type: "CATHOLIC SCHOOL", address: "1240 Tupper Drive", lat: 43.527842, lng: -79.852441 },
  { name: "St. Benedict", type: "CATHOLIC SCHOOL", address: "80 Mclaughlin Avenue", lat: 43.495477, lng: -79.866493 },
  { name: "St. Francis Xavier", type: "SECONDARY SCHOOL", address: "1145 Bronte Street S", lat: 43.487396, lng: -79.85709 },
  { name: "St. Josephine Bakhita Catholic Elementary School", type: "CATHOLIC SCHOOL", address: "Tbd, Sp 32-21", lat: 43.476029, lng: -79.862391 },
  { name: "St. Peter", type: "CATHOLIC SCHOOL", address: "137 Dixon Dr", lat: 43.533915, lng: -79.864557 },
  { name: "St. Scholastica", type: "CATHOLIC SCHOOL", address: "170 Whitlock Avenue", lat: 43.48483, lng: -79.85207 },
  { name: "Tiger Jeet Singh", type: "PUBLIC SCHOOL", address: "650 Yates Drive", lat: 43.507012, lng: -79.85266 },
  { name: "Viola Desmond", type: "PUBLIC SCHOOL", address: "1450 Legar Way", lat: 43.483387, lng: -79.847273 },
  { name: "W.I. Dick", type: "PUBLIC SCHOOL", address: "351 Highside Dr", lat: 43.520959, lng: -79.887706 },
];

export const TOWN_PARKS: readonly TownPark[] = [
  { name: "16 Mile Creek Park - North", classification: "LINEAR", address: "475 Commercial Street", lat: 43.508309, lng: -79.868683 },
  { name: "16 Mile Creek Park - South", classification: "LINEAR", address: "300 Laurier Avenue", lat: 43.505564, lng: -79.86497 },
  { name: "Baldwin Park", classification: "NEIGHBOURHOOD", address: "191 Wilson Drive", lat: 43.527668, lng: -79.876746 },
  { name: "Barclay Park", classification: "VILLAGE", address: "1045 Barclay Circle", lat: 43.516562, lng: -79.847779 },
  { name: "Beaty Neghbourhood Park - North", classification: "NEIGHBOURHOOD", address: "670 Bennett Boulevard", lat: 43.517237, lng: -79.842791 },
  { name: "Beaty Neighbourhood Park - South", classification: "NEIGHBOURHOOD", address: "820 Bennett Boulevard", lat: 43.515511, lng: -79.840353 },
  { name: "Beaty Trail Park", classification: "VILLAGE", address: "675 Trudeau Drive", lat: 43.525928, lng: -79.834166 },
  { name: "Beaver Court Park", classification: "VILLAGE", address: "555 Beaver Court", lat: 43.512908, lng: -79.863809 },
  { name: "Benjamin Chee Chee Park", classification: "VILLAGE", address: "1350 Chee Chee Landing", lat: 43.488195, lng: -79.844001 },
  { name: "Bennett Park", classification: "NEIGHBOURHOOD", address: "830 Bennett Boulevard", lat: 43.514854, lng: -79.839195 },
  { name: "Brian Best Park", classification: "DISTRICT", address: "320 Parkway Drive W", lat: 43.508057, lng: -79.871777 },
  { name: "Bristol Park", classification: "DISTRICT", address: "920 Kennedy Circle", lat: 43.506573, lng: -79.839699 },
  { name: "Bronson Park", classification: "VILLAGE", address: "205 Bronson Terrace", lat: 43.480935, lng: -79.84463 },
  { name: "Bronte Meadows Park", classification: "DISTRICT", address: "165 Laurier Avenue", lat: 43.502613, lng: -79.87234 },
  { name: "Brookville Park", classification: "DISTRICT", address: "11305 Guelph Line", lat: 43.533141, lng: -80.044066 },
  { name: "Burling Park", classification: "VILLAGE", address: "865 Yates Drive", lat: 43.512634, lng: -79.850907 },
  { name: "Bussel Park", classification: "VILLAGE", address: "416 Bussel Crescent", lat: 43.530761, lng: -79.852459 },
  { name: "Campbellville New Park", classification: "NEIGHBOURHOOD", address: "2680 Reid Side Road", lat: 43.488381, lng: -79.986393 },
  { name: "Campbellville Old Park", classification: "NEIGHBOURHOOD", address: "105 Campbell Avenue E", lat: 43.489793, lng: -79.980687 },
  { name: "Cedar Hedge Park - East", classification: "NEIGHBOURHOOD", address: "225 Cedar Hedge Road", lat: 43.533366, lng: -79.848963 },
  { name: "Cedar Hedge Park - West (Off Leash Dog Park)", classification: "NEIGHBOURHOOD", address: "230 Cedar Hedge Road", lat: 43.532637, lng: -79.850559 },
  { name: "Centennial Park", classification: "COMMUNITY", address: "50 Martin Street", lat: 43.514235, lng: -79.884501 },
  { name: "Centre Park", classification: "NEIGHBOURHOOD", address: "798 Graham Bell Court", lat: 43.528927, lng: -79.872495 },
  { name: "Chris Hadfield Park", classification: "NEIGHBOURHOOD", address: "1 Chris Hadfield Way", lat: 43.522016, lng: -79.89632 },
  { name: "Clarke Neighbourhood Park", classification: "NEIGHBOURHOOD", address: "1203 Laurier Avenue", lat: 43.5269, lng: -79.850887 },
  { name: "Clarke Neighbourhood Park", classification: "NEIGHBOURHOOD", address: "1170 Laurier Avenue", lat: 43.524295, lng: -79.849977 },
  { name: "Coates Linear Park", classification: "LINEAR", address: "751 Hepburn Road", lat: 43.503326, lng: -79.845004 },
  { name: "Coates Neighbourhood Park North", classification: "NEIGHBOURHOOD", address: "776 Philbrook Drive", lat: 43.508748, lng: -79.851144 },
  { name: "Coates Neighbourhood Park South", classification: "NEIGHBOURHOOD", address: "785 Bolingbroke Drive", lat: 43.507098, lng: -79.848486 },
  { name: "Cobban Neighbourhood Park", classification: "NEIGHBOURHOOD", address: "840 Whitlock Avenue", lat: 43.499089, lng: -79.834919 },
  { name: "Coulson Park", classification: "NEIGHBOURHOOD", address: "754 Coulson Avenue", lat: 43.515717, lng: -79.861593 },
  { name: "Court Park", classification: "NEIGHBOURHOOD", address: "558 Brock Court", lat: 43.523739, lng: -79.877954 },
  { name: "Coxe Boulevard Park", classification: "NEIGHBOURHOOD", address: "314 Coxe Boulevard", lat: 43.5193, lng: -79.862785 },
  { name: "David Thompson Park", classification: "NEIGHBOURHOOD", address: "378 Maplewood Crescent", lat: 43.50585, lng: -79.87438 },
  { name: "Dempsey Neighbourhood Park", classification: "NEIGHBOURHOOD", address: "187 Dixon Drive", lat: 43.534769, lng: -79.866051 },
  { name: "Drumquin Park", classification: "DISTRICT", address: "12535 Britannia Road", lat: 43.534509, lng: -79.788047 },
  { name: "Fay Court Park", classification: "NEIGHBOURHOOD", address: "621 Woodward Avenue", lat: 43.527618, lng: -79.88112 },
  { name: "Featherstone Park", classification: "VILLAGE", address: "967 Stoutt Crescent", lat: 43.502643, lng: -79.853119 },
  { name: "Field Park", classification: "VILLAGE", address: "1157 Field Drive", lat: 43.520559, lng: -79.850176 },
  { name: "Fitzgerald Park", classification: "VILLAGE", address: "204 Fitzgerald Crescent", lat: 43.535778, lng: -79.870624 },
  { name: "Ford Neighbourhood Park", classification: "NEIGHBOURHOOD", address: "1400 Leger Way", lat: 43.483657, lng: -79.849468 },
  { name: "Gastle Park", classification: "VILLAGE", address: "273 Schreyer Crescent", lat: 43.484941, lng: -79.867062 },
  { name: "Harrison Park", classification: "VILLAGE", address: "364 Nakerville Crescent", lat: 43.48116, lng: -79.869771 },
  { name: "Harwood Park", classification: "VILLAGE", address: "1521 Harwood Drive", lat: 43.527826, lng: -79.840963 },
  { name: "Holloway Park", classification: "VILLAGE", address: "53 Scott Boulevard", lat: 43.5033, lng: -79.89094 },
  { name: "Hutchinson Park", classification: "VILLAGE", address: "736 Hutchinson Avenue", lat: 43.515015, lng: -79.845243 },
  { name: "Kingsleigh Park", classification: "NEIGHBOURHOOD", address: "265 Kingsleigh Court", lat: 43.521773, lng: -79.890691 },
  { name: "Kinsmen Park", classification: "DISTRICT", address: "196 Wilson Drive", lat: 43.52594, lng: -79.879261 },
  { name: "Knight Trail Park", classification: "VILLAGE", address: "1215 Knight Trail", lat: 43.536776, lng: -79.863232 },
  { name: "Laidlaw Park", classification: "VILLAGE", address: "1059 Laidlaw Drive", lat: 43.523639, lng: -79.856273 },
  { name: "Laurier Park", classification: "NEIGHBOURHOOD", address: "756 Laurier Avenue", lat: 43.516272, lng: -79.857163 },
  { name: "Leiterman Park", classification: "VILLAGE", address: "284 Leiterman Drive", lat: 43.491213, lng: -79.857434 },
  { name: "Lions Sports Park", classification: "DISTRICT", address: "99 Thompson Road S", lat: 43.527691, lng: -79.861095 },
  { name: "Livingston Park", classification: "COMMUNITY", address: "210 Margaret Street", lat: 43.514244, lng: -79.887157 },
  { name: "Luxton Park", classification: "VILLAGE", address: "864 Luxton Drive", lat: 43.511431, lng: -79.84128 },
  { name: "Maquire Park", classification: "VILLAGE", address: "940 Maquire Terrace", lat: 43.508096, lng: -79.84393 },
  { name: "Mccready Park", classification: "VILLAGE", address: "431 Scott Boulevard", lat: 43.495062, lng: -79.88027 },
  { name: "Mcdougall Park", classification: "VILLAGE", address: "363 Mcdougall Crossing", lat: 43.487952, lng: -79.878286 },
  { name: "Mcduffe Park", classification: "VILLAGE", address: "1480 Clark Boulevard", lat: 43.519497, lng: -79.832703 },
  { name: "Meighen Park", classification: "VILLAGE", address: "1108 Meighen Way", lat: 43.513314, lng: -79.834181 },
  { name: "Melanie Park", classification: "NEIGHBOURHOOD", address: "747 Woodward Avenue", lat: 43.530754, lng: -79.877207 },
  { name: "Menefy Park", classification: "VILLAGE", address: "1314 Menefy Place", lat: 43.521634, lng: -79.837759 },
  { name: "Milton Community Park", classification: "COMMUNITY", address: "805 Santa Maria Boulevard", lat: 43.499129, lng: -79.85633 },
  { name: "Moffat Park", classification: "NEIGHBOURHOOD", address: "1250 No 15 Side Road", lat: 43.502048, lng: -80.060474 },
  { name: "Moorelands Park", classification: "LINEAR", address: "504 Laurier Avenue", lat: 43.509102, lng: -79.860469 },
  { name: "Oakview Park", classification: "VILLAGE", address: "1409 Storey Drive", lat: 43.516861, lng: -79.830858 },
  { name: "Omagh Park", classification: "NEIGHBOURHOOD", address: "1426 Britannia Road W", lat: 43.504234, lng: -79.814154 },
  { name: "Optimist Park", classification: "NEIGHBOURHOOD", address: "881 Savoline Boulevard", lat: 43.485978, lng: -79.872444 },
  { name: "Proposed Walker Neighbourhood Park", classification: "NEIGHBOURHOOD", address: "1325 Kovachik Boulevard", lat: 43.474832, lng: -79.860908 },
  { name: "Raspberry Park", classification: "VILLAGE", address: "1280 Raspberry Terrace", lat: 43.491477, lng: -79.849133 },
  { name: "Rotary Park", classification: "COMMUNITY", address: "100 Garden Lane", lat: 43.512733, lng: -79.888301 },
  { name: "Sam Sherratt Park", classification: "NEIGHBOURHOOD", address: "655 Laurier Avenue", lat: 43.514411, lng: -79.861597 },
  { name: "Sam Sherratt Trail Park", classification: "LINEAR", address: "505 Laurier Avenue", lat: 43.510729, lng: -79.864256 },
  { name: "Sam Sherratt Trail Park", classification: "LINEAR", address: "754 Coulson Avenue", lat: 43.517372, lng: -79.863482 },
  { name: "Sam Sherratt Trail Park", classification: "LINEAR", address: "211 Ledwith Drive", lat: 43.517835, lng: -79.865182 },
  { name: "Savoline Park", classification: "VILLAGE", address: "447 Savoline Boulevard", lat: 43.490638, lng: -79.884873 },
  { name: "Scott Neighbourhood Park - East", classification: "NEIGHBOURHOOD", address: "143 Scott Boulevard", lat: 43.501796, lng: -79.886468 },
  { name: "Scott Neighbourhood Park - West", classification: "NEIGHBOURHOOD", address: "351 Savoline Boulevard", lat: 43.493902, lng: -79.887045 },
  { name: "Sherwood District Park", classification: "DISTRICT", address: "6125 Main Street W", lat: 43.497245, lng: -79.897758 },
  { name: "Sinclair Park", classification: "VILLAGE", address: "40 Sinclair Boulevard", lat: 43.534355, lng: -79.857195 },
  { name: "Speyer Park", classification: "VILLAGE", address: "687 Marks Street", lat: 43.492294, lng: -79.872785 },
  { name: "Spice Of Life Parkette", classification: "PARKETTE", address: "254 Main Street E", lat: 43.51363, lng: -79.881655 },
  { name: "Sprucedale Park", classification: "VILLAGE", address: "1050 Sprucedale Lane", lat: 43.531407, lng: -79.867247 },
  { name: "Sunny Mount Park (Off Leash Dog Park)", classification: "NEIGHBOURHOOD", address: "255 Ruhl Drive", lat: 43.493982, lng: -79.862969 },
  { name: "Timberlea Trail", classification: "LINEAR", address: "210 Ledwith Drive", lat: 43.518395, lng: -79.867589 },
  { name: "Trudeau Park", classification: "VILLAGE", address: "475 Trudeau Drive", lat: 43.53075, lng: -79.841867 },
  { name: "Victoria Park", classification: "VILLAGE", address: "44 Brown Street", lat: 43.510083, lng: -79.88418 },
  { name: "Wakefield Park", classification: "NEIGHBOURHOOD", address: "139 Wakefield Road", lat: 43.51521, lng: -79.874455 },
  { name: "Wallbrook Park", classification: "VILLAGE", address: "1146 Barclay Circle", lat: 43.517069, lng: -79.848926 },
  { name: "Watson Park", classification: "VILLAGE", address: "1599 Clark Boulevard", lat: 43.523677, lng: -79.830523 },
  { name: "Willmott Linear Park", classification: "LINEAR", address: "115 Ruhl Drive", lat: 43.492062, lng: -79.864633 },
  { name: "Willmott Neighbourhood Park", classification: "NEIGHBOURHOOD", address: "820 Asleton Boulevard", lat: 43.490254, lng: -79.867648 },
  { name: "Winn Park", classification: "VILLAGE", address: "671 Winn Trail", lat: 43.508651, lng: -79.857578 },
];

export const TOWN_PLACES_PULLED = "2026-08-14";
