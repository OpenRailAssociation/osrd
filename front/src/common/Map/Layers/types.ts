import { MapState } from 'reducers/map';
import { Theme } from 'types';

export type SignalContext = {
  prefix: string;
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
