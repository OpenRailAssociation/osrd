import type {
  LayerProps as LayerPropsWithCustom,
  CustomLayerInterface,
} from 'react-map-gl/maplibre';

import type { Theme } from 'common/Map/theme';
import type { EditorState } from 'reducers/editor';
import type { MapState } from 'reducers/map';

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
  layersSettings: MapState['mapSettings']['layersSettings'];
  issuesSettings?: EditorState['issuesSettings'];
};

export type LayerProps = Exclude<LayerPropsWithCustom, CustomLayerInterface>;
