import { Tool } from './types';

import SelectionTool from './selection/tool';
import ZoneSelectionTool from './zoneSelection/tool';
import TrackEditionTool from './trackEdition/tool';

const TOOLS: Tool<any>[] = [ZoneSelectionTool, SelectionTool, TrackEditionTool];

export default TOOLS;
