import config from 'config/config';

export * from 'common/Map/Consts/SignalsNames';

// Map constants
export const MAP_URL = config.proxy_editoast + "/layers";
export const OSM_URL = 'https://osm.osrd.fr/data/v3.json';

export const MAP_MODES = {
  display: 'display',
  modification: 'modification',
  creation: 'creation',
};

// [jacomyal]
// I'm not sure why this object remains here, but I need to refer to this
// 'track_sections' value elsewhere, which explains the new MAP_TRACK_SOURCE:
export const MAP_TRACK_SOURCE = 'track_sections';
export const MAP_TRACK_SOURCES = {
  schematic: MAP_TRACK_SOURCE,
  geographic: MAP_TRACK_SOURCE,
};

export const ELEMENT_TYPES = {
  objects: 'objects',
  groups: 'groups',
};

// Objects constants
// Labels
export const FIELDS_LABEL = {
  L_code: 'Code ligne',
  V_nom: 'Nom voie',
  pk_sncf: 'PK',
  LP_sensLecture: 'Sens de lecture',
  TIF_mnemo: 'Type',
  RA_libelle: 'Libellé',
  RA_poste: 'Poste',
  RA_gare: 'Gare',
  extremites: 'Extrémités',
  RLJDZ_sens: 'RLJDZ_sens',
  RLE_sens: 'RLE_sens',
  is_utilisable_isolement: 'Utilisable isolement',
  Z_ttx: 'Train travaux interdits',
  RA_libelle_signal_destination: 'Signal de destination',
  RA_libelle_signal_origine: "Signal d'origine",
  BAPV_direction: 'Direction',
  BAPV_codeBranche: 'Numero de branche',
  branches: 'Branches',
  adv_libelle: 'Libellé',
  adv_positionnes: 'Aiguilles',
  L_ordre: 'Ordre',
  CAV_rang: 'Rang',
  codeBranche_debut: 'Code branche début',
  codeBranche_fin: 'Code branche fin',
  codeBranche: 'Code branche',
  BAPV_pointObservation: "Point d'observation",
  cles_protections: 'Clé protections',
  cle: 'Clé',
  itineraires: 'Itinéraires',
  itineraires_incompatibles: 'Itinéraire Incompatibles',
};
