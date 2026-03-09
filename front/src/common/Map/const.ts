import config from 'config/config';
import { absoluteUrl } from 'utils/strings';

// Map constants
export const MAP_URL = `${config.proxy_editoast}/layers`;
export const SPRITES_URL = absoluteUrl(`${config.proxy_editoast}/sprites`);
export const FONTS_URL = `${config.proxy_editoast}/fonts`;

export const OSM_URL = 'pmtiles://https://tuiles.enliberte.fr/planet.pmtiles';
export const TERRAIN_URL = 'pmtiles://https://tuiles.enliberte.fr/terrain-europe.pmtiles';

export const CUSTOM_ATTRIBUTION = '© SNCF Réseau';

// [jacomyal]
// I'm not sure why this object remains here, but I need to refer to this
// 'track_sections' value elsewhere, which explains the new MAP_TRACK_SOURCE:
export const MAP_TRACK_SOURCE = 'track_sections';
export const MAP_TRACK_SOURCES = {
  geographic: MAP_TRACK_SOURCE,
};

// mapKey
export type MapKeyProps = {
  active?: boolean;
  closeMapKeyPopUp: () => void;
};

type SpeedLimitKey = {
  speed: string;
  text: string;
};

export const speedLimitMapKey: SpeedLimitKey[] = [
  { speed: 'v300', text: '> 220km/h' },
  { speed: 'v200', text: '161km/h - 220km/h' },
  { speed: 'v160', text: '140km/h - 160km/h' },
  { speed: 'v100', text: '100km/h - 139km/h' },
  { speed: 'v60', text: '61km/h - 99km/h' },
  { speed: 'v30', text: '31km/h - 60km/h' },
  { speed: 'v0', text: '1km/h - 30km/h' },
];

type ElectrificationKey = {
  color: string;
  text: string;
  current: 'alternatingCurrent' | 'directCurrent' | null;
};

export const electrificationMapKey: ElectrificationKey[] = [
  { color: 'color25000V', text: '25000V', current: 'alternatingCurrent' },
  { color: 'color15000V1623', text: '15000V 16 2/3', current: null },
  { color: 'color3000V', text: '3000V', current: 'directCurrent' },
  { color: 'color1500V', text: '1500V', current: 'directCurrent' },
  { color: 'color850V', text: '850V', current: 'directCurrent' },
  { color: 'color800V', text: '800V', current: 'directCurrent' },
  { color: 'color750V', text: '750V', current: 'directCurrent' },
];
