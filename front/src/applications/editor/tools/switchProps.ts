import {
  BufferStopEntity,
  CatenaryEntity,
  DetectorEntity,
  SignalEntity,
  SpeedSectionEntity,
} from 'types';
import { RouteEditionState } from './routeEdition/types';
import { SelectionState } from './selection/types';
import { TrackEditionState } from './trackEdition/types';
import { RangeEditionState } from './rangeEdition/types';
import { PointEditionState } from './pointEdition/types';
import TOOL_TYPES from './toolTypes';
import { SwitchEditionState } from './switchEdition/types';

export type switchProps =
  | { toolType: TOOL_TYPES.SELECTION; toolState: Partial<SelectionState> }
  | { toolType: TOOL_TYPES.TRACK_EDITION; toolState: Partial<TrackEditionState> }
  | {
      toolType: TOOL_TYPES.SPEED_SECTION_EDITION;
      toolState: Partial<RangeEditionState<SpeedSectionEntity>>;
    }
  | { toolType: TOOL_TYPES.CATENARY_EDITION; toolState: Partial<RangeEditionState<CatenaryEntity>> }
  | { toolType: TOOL_TYPES.SWITCH_EDITION; toolState: Partial<SwitchEditionState> }
  | { toolType: TOOL_TYPES.SIGNAL_EDITION; toolState: Partial<PointEditionState<SignalEntity>> }
  | { toolType: TOOL_TYPES.DETECTOR_EDITION; toolState: Partial<PointEditionState<DetectorEntity>> }
  | {
      toolType: TOOL_TYPES.BUFFER_STOP_EDITION;
      toolState: Partial<PointEditionState<BufferStopEntity>>;
    }
  | { toolType: TOOL_TYPES.ROUTE_EDITION; toolState: Partial<RouteEditionState> };
