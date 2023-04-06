import { Tool } from './types';

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TOOLS: Tool<any>[] = [
  SelectionTool,
  TrackEditionTool,
  SpeedSectionEditionTool,
  SwitchEditionTool,
  SignalEditionTool,
  DetectorEditionTool,
  BufferStopEditionTool,
  RouteEditionTool,
];

export default TOOLS;
