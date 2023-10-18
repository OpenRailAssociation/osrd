import { MapState } from 'reducers/map';
import { SignalContext } from './geoSignalsLayers';

export interface LayerContext extends SignalContext {
  sourceTable?: string;
  isEmphasized: boolean;
  showIGNBDORTHO: boolean;
  layersSettings: MapState['layersSettings'];
  issuesSettings?: MapState['issuesSettings'];
}
