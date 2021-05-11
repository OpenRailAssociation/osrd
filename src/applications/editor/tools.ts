import { Dispatch } from 'redux';
import { IconType } from 'react-icons/lib/esm/iconBase';

import { EditorState } from '../../reducers/editor';
import { SelectZone } from './tools/SelectZone';
import { CreateLine } from './tools/CreateLine';
import { SelectItems } from './tools/SelectItems';

export interface ToolAction<S> {
  id: string;
  icon: IconType;
  labelTranslationKey: string;
  descriptionTranslationKeys?: string[];
  // Tool appearance:
  isActive?: (toolState: S, editorState: EditorState) => boolean;
  isHidden?: (toolState: S, editorState: EditorState) => boolean;
  isDisabled?: (state: S, editorState: EditorState) => boolean;
  // On click button:
  onClick?: (
    context: { setState(state: S): void; dispatch: Dispatch },
    toolState: S,
    editorState: EditorState
  ) => void;
}

export type ToolId = 'select-zone' | 'select-item' | 'create-line';

export interface Tool<S> {
  id: ToolId;
  icon: IconType;
  labelTranslationKey: string;
  descriptionTranslationKeys: string[];
  actions: ToolAction<S>[][];
  getInitialState: () => S;
  isDisabled?: (editorState: EditorState) => boolean;
}

export const Tools: Tool<any>[] = [SelectZone, CreateLine, SelectItems];
