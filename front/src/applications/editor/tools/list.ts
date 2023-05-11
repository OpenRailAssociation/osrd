import { BufferStopEntity, DetectorEntity, SignalEntity } from 'types';
import SelectionTool from './selection/tool';
import TrackEditionTool from './trackEdition/tool';
import SwitchEditionTool from './switchEdition/tool';
import {
  BufferStopEditionTool,
  DetectorEditionTool,
  SignalEditionTool,
} from './pointEdition/tools';
import RouteEditionTool from './routeEdition/tool';
import SpeedSectionEditionTool from './speedSectionEdition/tool';
import { RouteEditionState } from './routeEdition/types';
import { SelectionState } from './selection/types';
import { TrackEditionState } from './trackEdition/types';
import { SpeedSectionEditionState } from './speedSectionEdition/types';
import { SwitchEditionState } from './switchEdition/types';
import { PointEditionState } from './pointEdition/types';

export enum TOOL_TYPES {
  SELECTION = 'select-items',
  TRACK_EDITION = 'track-edition',
  SPEED_SECTION_EDITION = 'speed-edition',
  SWITCH_EDITION = 'switch-edition',
  SIGNAL_EDITION = 'signal-edition',
  DETECTOR_EDITION = 'detector-edition',
  BUFFER_STOP_EDITION = 'buffer-stop-edition',
  ROUTE_EDITION = 'route-edition',
}

export type switchProps =
  | { toolType: TOOL_TYPES.SELECTION; toolState: Partial<SelectionState> }
  | { toolType: TOOL_TYPES.TRACK_EDITION; toolState: Partial<TrackEditionState> }
  | { toolType: TOOL_TYPES.SPEED_SECTION_EDITION; toolState: Partial<SpeedSectionEditionState> }
  | { toolType: TOOL_TYPES.SWITCH_EDITION; toolState: Partial<SwitchEditionState> }
  | { toolType: TOOL_TYPES.SIGNAL_EDITION; toolState: Partial<PointEditionState<SignalEntity>> }
  | { toolType: TOOL_TYPES.DETECTOR_EDITION; toolState: Partial<PointEditionState<DetectorEntity>> }
  | {
      toolType: TOOL_TYPES.BUFFER_STOP_EDITION;
      toolState: Partial<PointEditionState<BufferStopEntity>>;
    }
  | { toolType: TOOL_TYPES.ROUTE_EDITION; toolState: Partial<RouteEditionState> };

const TOOLS = Object.freeze({
  [TOOL_TYPES.SELECTION]: SelectionTool,
  [TOOL_TYPES.TRACK_EDITION]: TrackEditionTool,
  [TOOL_TYPES.SPEED_SECTION_EDITION]: SpeedSectionEditionTool,
  [TOOL_TYPES.SWITCH_EDITION]: SwitchEditionTool,
  [TOOL_TYPES.SIGNAL_EDITION]: SignalEditionTool,
  [TOOL_TYPES.DETECTOR_EDITION]: DetectorEditionTool,
  [TOOL_TYPES.BUFFER_STOP_EDITION]: BufferStopEditionTool,
  [TOOL_TYPES.ROUTE_EDITION]: RouteEditionTool,
});

export default TOOLS;
