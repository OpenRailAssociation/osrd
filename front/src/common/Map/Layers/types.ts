import type {
  LayerProps as LayerPropsWithCustom,
  CustomLayerInterface,
} from 'react-map-gl/maplibre';

import type { MapState } from 'reducers/map';
import type { Theme } from 'types';

export type SignalContext = {
  sourceTable?: string;
  sidePropertyName?: string;
  colors: Theme;
  minzoom?: number;
  maxzoom?: number;
};

export type LayerContext = SignalContext & {
  sourceTable?: string;
  isEmphasized: boolean;
  showIGNBDORTHO: boolean;
  layersSettings: MapState['layersSettings'];
  issuesSettings?: MapState['issuesSettings'];
};

export type LayerProps = Exclude<LayerPropsWithCustom, CustomLayerInterface>;
