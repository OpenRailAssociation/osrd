import { Tool } from './types';

import SelectionTool from './selection/tool';
import ZoneSelectionTool from './zoneSelection/tool';
import TrackEditionTool from './trackEdition/tool';
import SwitchEditionTool from './switchEdition/tool';
import {
  BufferStopEditionTool,
  DetectorEditionTool,
  SignalEditionTool,
} from './pointEdition/tools';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TOOLS: Tool<any>[] = [
  ZoneSelectionTool,
  SelectionTool,
  TrackEditionTool,
  SwitchEditionTool,
  SignalEditionTool,
  DetectorEditionTool,
  BufferStopEditionTool,
];

export default TOOLS;
