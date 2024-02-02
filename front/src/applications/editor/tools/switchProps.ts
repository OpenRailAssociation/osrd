import { RouteEditionState } from './routeEdition/types';
import { SelectionState } from './selection/types';
import { TrackEditionState } from './trackEdition/types';
import { ElectrificationEntity, RangeEditionState, SpeedSectionEntity } from './rangeEdition/types';
import {
  BufferStopEntity,
  DetectorEntity,
  PointEditionState,
  SignalEntity,
} from './pointEdition/types';
import { SwitchEditionState } from './switchEdition/types';
import TOOL_NAMES from './constsToolNames';

export type switchProps =
  | { toolType: TOOL_NAMES.SELECTION; toolState: Partial<SelectionState> }
  | { toolType: TOOL_NAMES.TRACK_EDITION; toolState: Partial<TrackEditionState> }
  | {
      toolType: TOOL_NAMES.SPEED_SECTION_EDITION;
      toolState: Partial<RangeEditionState<SpeedSectionEntity>>;
    }
  | {
      toolType: TOOL_NAMES.ELECTRIFICATION_EDITION;
      toolState: Partial<RangeEditionState<ElectrificationEntity>>;
    }
  | { toolType: TOOL_NAMES.SWITCH_EDITION; toolState: Partial<SwitchEditionState> }
  | { toolType: TOOL_NAMES.SIGNAL_EDITION; toolState: Partial<PointEditionState<SignalEntity>> }
  | { toolType: TOOL_NAMES.DETECTOR_EDITION; toolState: Partial<PointEditionState<DetectorEntity>> }
  | {
      toolType: TOOL_NAMES.BUFFER_STOP_EDITION;
      toolState: Partial<PointEditionState<BufferStopEntity>>;
    }
  | { toolType: TOOL_NAMES.ROUTE_EDITION; toolState: Partial<RouteEditionState> };
