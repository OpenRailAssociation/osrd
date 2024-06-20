import type { LinearMetadataItem } from 'common/IntervalsDataViz/types';

export enum INTERVAL_TYPES {
  NUMBER = 'number',
  NUMBER_WITH_UNIT = 'number-with-unit',
  SELECT = 'select',
}

export type IntervalItem = LinearMetadataItem<{ value: number | string; unit?: string }>;
export type AdditionalDataItem = LinearMetadataItem<{ value: number | string }>;

export enum INTERVALS_EDITOR_TOOLS {
  ADD_TOOL = 'add-tool',
  CUT_TOOL = 'cut-tool',
  DELETE_TOOL = 'delete-tool',
  MERGE_TOOL = 'merge-tool',
  TRANSLATE_TOOL = 'translate-tool',
}
export type IntervalsEditorTool =
  | INTERVALS_EDITOR_TOOLS.ADD_TOOL
  | INTERVALS_EDITOR_TOOLS.CUT_TOOL
  | INTERVALS_EDITOR_TOOLS.DELETE_TOOL
  | INTERVALS_EDITOR_TOOLS.MERGE_TOOL
  | INTERVALS_EDITOR_TOOLS.TRANSLATE_TOOL;

export type IntervalsEditorToolsConfig = {
  cutTool?: boolean;
  deleteTool?: boolean;
  mergeTool?: boolean;
  translateTool?: boolean;
  addTool?: boolean;
};
