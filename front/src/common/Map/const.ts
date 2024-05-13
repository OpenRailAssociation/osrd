import config from 'config/config';

export * from 'common/Map/Consts/SignalsNames';

// Map constants
export const MAP_URL = `${config.proxy_editoast}/layers`;
export const SPRITES_URL = `${config.proxy_editoast}/sprites`;
/* Put here the real url of PMTILES file */
export const OSM_URL = 'pmtiles://http://localhost/temp/france.pmtiles';
/************* LINTER WARNING TO THINK ABOUT IT */

export const MAP_MODES = {
  display: 'display',
  modification: 'modification',
  creation: 'creation',
};

export const CUSTOM_ATTRIBUTION = '© SNCF Réseau';

// [jacomyal]
// I'm not sure why this object remains here, but I need to refer to this
// 'track_sections' value elsewhere, which explains the new MAP_TRACK_SOURCE:
export const MAP_TRACK_SOURCE = 'track_sections';
export const MAP_TRACK_SOURCES = {
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

// mapKey
export interface MapKeyProps {
  active?: boolean;
  closeMapKeyPopUp: () => void;
}

interface SpeedLimitKey {
  speed: string;
  text: string;
}

export const speedLimitMapKey: SpeedLimitKey[] = [
  { speed: 'v300', text: '> 220km/h' },
  { speed: 'v200', text: '161km/h - 220km/h' },
  { speed: 'v160', text: '140km/h - 160km/h' },
  { speed: 'v100', text: '100km/h - 139km/h' },
  { speed: 'v60', text: '61km/h - 99km/h' },
  { speed: 'v30', text: '31km/h - 60km/h' },
  { speed: 'v0', text: '1km/h - 30km/h' },
];

interface ElectrificationKey {
  color: string;
  text: string;
  current: string;
}

export const electrificationMapKey: ElectrificationKey[] = [
  { color: 'color25000V', text: '25000V', current: 'alternatingCurrent' },
  { color: 'color15000V1623', text: '15000V 16 2/3', current: '' },
  { color: 'color3000V', text: '3000V', current: 'directCurrent' },
  { color: 'color1500V', text: '1500V', current: 'directCurrent' },
  { color: 'color850V', text: '850V', current: 'directCurrent' },
  { color: 'color800V', text: '800V', current: 'directCurrent' },
  { color: 'color750V', text: '750V', current: 'directCurrent' },
];
