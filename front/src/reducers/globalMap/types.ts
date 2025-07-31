import type { Position } from 'geojson';
import type { ViewState } from 'react-map-gl/maplibre';

export type MapSettings = {
  mapStyle: 'normal' | 'dark' | 'minimal';
  showIGNBDORTHO: boolean;
  showIGNSCAN25: boolean;
  showIGNCadastre: boolean;
  showOSM: boolean;
  showOSM3dBuildings: boolean;
  showOSMtracksections: boolean;
  terrain3DExaggeration: number;
  smoothTravel: boolean;
  layersSettings: LayersSettings;
  mapSearchMarker?: MapSearchMarker;
  lineSearchCode?: number;
  viewport: Viewport;
};

export type LayersSettings = {
  buffer_stops: boolean;
  electrifications: boolean;
  neutral_sections: boolean;
  detectors: boolean;
  operational_points: boolean;
  routes: boolean;
  signals: boolean;
  sncf_psl: boolean;
  speedlimittag: string | null;
  speed_limits: boolean;
  switches: boolean;
  platforms: boolean;
  tvds: boolean;
};

export type Viewport = ViewState & {
  width: number;
  height: number;
};

export type MapSearchMarker = {
  title: string;
  subtitle?: string;
  lonlat: Position;
};

export type MapStyle = 'normal' | 'dark' | 'minimal';
