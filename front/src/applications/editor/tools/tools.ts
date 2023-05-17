import TrackEditionTool from './trackEdition/tool';
import {
  BufferStopEditionTool,
  DetectorEditionTool,
  SignalEditionTool,
} from './pointEdition/tools';
import { CatenaryEditionTool, SpeedEditionTool } from './rangeEdition/tools';
import TOOL_TYPES from './toolTypes';
import SelectionTool from './selection/tool';
import SwitchEditionTool from './switchEdition/tool';
import RouteEditionTool from './routeEdition/tool';

const TOOLS = Object.freeze({
  [TOOL_TYPES.SELECTION]: SelectionTool,
  [TOOL_TYPES.TRACK_EDITION]: TrackEditionTool,
  [TOOL_TYPES.SPEED_SECTION_EDITION]: SpeedEditionTool,
  [TOOL_TYPES.CATENARY_EDITION]: CatenaryEditionTool,
  [TOOL_TYPES.SWITCH_EDITION]: SwitchEditionTool,
  [TOOL_TYPES.SIGNAL_EDITION]: SignalEditionTool,
  [TOOL_TYPES.DETECTOR_EDITION]: DetectorEditionTool,
  [TOOL_TYPES.BUFFER_STOP_EDITION]: BufferStopEditionTool,
  [TOOL_TYPES.ROUTE_EDITION]: RouteEditionTool,
});

export default TOOLS;
