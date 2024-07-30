import TOOL_NAMES from './constsToolNames';
import {
  BufferStopEditionTool,
  DetectorEditionTool,
  SignalEditionTool,
} from './pointEdition/tools';
import { ElectrificationEditionTool, SpeedEditionTool } from './rangeEdition/tools';
import RouteEditionTool from './routeEdition/tool';
import SelectionTool from './selection/tool';
import TrackNodeEditionTool from './trackNodeEdition/tool';
import TrackEditionTool from './trackEdition/tool';
import TrackSplitTool from './trackSplit/tool';

// This const needs to stay in a separate file to avoid import cycle.
const TOOLS = Object.freeze({
  [TOOL_NAMES.SELECTION]: SelectionTool,
  [TOOL_NAMES.TRACK_EDITION]: TrackEditionTool,
  [TOOL_NAMES.TRACK_SPLIT]: TrackSplitTool,
  [TOOL_NAMES.SPEED_SECTION_EDITION]: SpeedEditionTool,
  [TOOL_NAMES.ELECTRIFICATION_EDITION]: ElectrificationEditionTool,
  [TOOL_NAMES.SWITCH_EDITION]: TrackNodeEditionTool,
  [TOOL_NAMES.SIGNAL_EDITION]: SignalEditionTool,
  [TOOL_NAMES.DETECTOR_EDITION]: DetectorEditionTool,
  [TOOL_NAMES.BUFFER_STOP_EDITION]: BufferStopEditionTool,
  [TOOL_NAMES.ROUTE_EDITION]: RouteEditionTool,
});

export default TOOLS;
