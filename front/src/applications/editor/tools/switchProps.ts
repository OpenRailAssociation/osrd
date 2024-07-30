import type TOOL_NAMES from './constsToolNames';
import type {
  BufferStopEntity,
  DetectorEntity,
  PointEditionState,
  SignalEntity,
} from './pointEdition/types';
import type {
  ElectrificationEntity,
  RangeEditionState,
  SpeedSectionEntity,
} from './rangeEdition/types';
import type { RouteEditionState } from './routeEdition/types';
import type { SelectionState } from './selection/types';
import type { TrackNodeEditionState } from './trackNodeEdition/types';
import type { TrackEditionState } from './trackEdition/types';
import type { TrackSplitState } from './trackSplit/types';

export type switchProps =
  | { toolType: TOOL_NAMES.SELECTION; toolState: Partial<SelectionState> }
  | { toolType: TOOL_NAMES.TRACK_EDITION; toolState: Partial<TrackEditionState> }
  | { toolType: TOOL_NAMES.TRACK_SPLIT; toolState: Partial<TrackSplitState> }
  | {
      toolType: TOOL_NAMES.SPEED_SECTION_EDITION;
      toolState: Partial<RangeEditionState<SpeedSectionEntity>>;
    }
  | {
      toolType: TOOL_NAMES.ELECTRIFICATION_EDITION;
      toolState: Partial<RangeEditionState<ElectrificationEntity>>;
    }
  | { toolType: TOOL_NAMES.SWITCH_EDITION; toolState: Partial<TrackNodeEditionState> }
  | { toolType: TOOL_NAMES.SIGNAL_EDITION; toolState: Partial<PointEditionState<SignalEntity>> }
  | { toolType: TOOL_NAMES.DETECTOR_EDITION; toolState: Partial<PointEditionState<DetectorEntity>> }
  | {
      toolType: TOOL_NAMES.BUFFER_STOP_EDITION;
      toolState: Partial<PointEditionState<BufferStopEntity>>;
    }
  | { toolType: TOOL_NAMES.ROUTE_EDITION; toolState: Partial<RouteEditionState> };
