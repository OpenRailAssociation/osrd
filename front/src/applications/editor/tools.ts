import { Dispatch } from 'redux';
import { MapEvent } from 'react-map-gl';
import { IconType } from 'react-icons/lib/esm/iconBase';

import { EditorState } from '../../reducers/editor';
import { SelectZone } from './tools/SelectZone';
import { CreateLine } from './tools/CreateLine';
import { SelectItems } from './tools/SelectItems';
import { Item, PositionnedItem } from '../../types';
import { TFunction } from 'i18next';

export interface CommonToolState {
  mousePosition: [number, number];
  hovered: PositionnedItem | null;
}

export const DEFAULT_COMMON_TOOL_STATE: CommonToolState = {
  mousePosition: [NaN, NaN],
  hovered: null,
};

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

export type ToolId = 'select-zone' | 'select-items' | 'create-line';

export interface Tool<S extends CommonToolState> {
  id: ToolId;
  icon: IconType;
  labelTranslationKey: string;
  descriptionTranslationKeys: string[];
  actions: ToolAction<S>[][];
  getInitialState: () => S;
  isDisabled?: (editorState: EditorState) => boolean;
  getRadius?: (toolState: S, editorState: EditorState) => number;
  // Interactions with Mapbox:
  onClickMap?: (
    e: MapEvent,
    context: { setState(state: S): void; dispatch: Dispatch },
    toolState: S,
    editorState: EditorState
  ) => void;
  onClickFeature?: (
    feature: Item,
    e: MapEvent,
    context: { setState(state: S): void; dispatch: Dispatch },
    toolState: S,
    editorState: EditorState
  ) => void;
  onHover?: (
    e: MapEvent,
    context: { setState(state: S): void; dispatch: Dispatch },
    toolState: S,
    editorState: EditorState
  ) => void;
  getCursor?: (
    toolState: S,
    editorState: EditorState,
    mapState: { isLoaded: boolean; isDragging: boolean; isHovering: boolean }
  ) => string;
  // Display:
  getInteractiveLayers?: (
    context: { setState(state: S): void; dispatch: Dispatch; t: TFunction; mapStyle: string },
    toolState: S,
    editorState: EditorState
  ) => string[];
  getLayers?: (
    context: { setState(state: S): void; dispatch: Dispatch; t: TFunction; mapStyle: string },
    toolState: S,
    editorState: EditorState
  ) => JSX.Element | null;
  getDOM?: (
    context: { setState(state: S): void; dispatch: Dispatch; t: TFunction },
    toolState: S,
    editorState: EditorState
  ) => JSX.Element | null | undefined;
  getMessages?: (
    context: { t: TFunction },
    toolState: S,
    editorState: EditorState
  ) => JSX.Element | null | undefined;
}

export const Tools: Tool<any>[] = [SelectZone, CreateLine, SelectItems];
