import '@osrd-project/ui-core/dist/theme.css';
import './styles/main.css';

export {
  default as SpeedSpaceChart,
  type SpeedSpaceChartProps,
} from './components/SpeedSpaceChart';
export type {
  LayerData,
  PowerRestrictionValues,
  ElectricalProfileValues,
  ElectrificationValues,
  SpeedLimitTagValues,
  Data as SpeedSpaceChartData,
  EtcsBrakingCurve,
  EtcsBrakingCurves,
} from './types';
export { EtcsBrakingCurveType, EtcsBrakingType } from './types';
