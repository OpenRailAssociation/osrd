import { Tool } from './types';

import SelectionTool from './selection/tool';
import ZoneSelectionTool from './zoneSelection/tool';
import { LineCreationTool } from './lineCreation/tool';

const TOOLS: Tool<any>[] = [ZoneSelectionTool, SelectionTool, LineCreationTool];

export default TOOLS;
