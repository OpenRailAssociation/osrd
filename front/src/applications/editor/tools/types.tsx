import { ComponentType } from 'react';
import { Dispatch } from 'redux';
import { MapEvent, ViewportProps } from 'react-map-gl';
import { IconType } from 'react-icons/lib/esm/iconBase';
import { TFunction } from 'i18next';

import { Item, PositionnedItem } from '../../../types';
import { EditorState } from '../../../reducers/editor';

export interface ModalProps<ArgumentsType, SubmitArgumentsType = Record<string, unknown>> {
  arguments: ArgumentsType;
  cancel: () => void;
  submit: (args: SubmitArgumentsType) => void;
}

export interface ModalRequest<ArgumentsType, SubmitArgumentsType> {
  component: ComponentType<ModalProps<ArgumentsType, SubmitArgumentsType>>;
  arguments: ArgumentsType;
  beforeCancel?: () => void;
  afterCancel?: () => void;
  beforeSubmit?: (args: SubmitArgumentsType) => void;
  afterSubmit?: (args: SubmitArgumentsType) => void;
}

export interface EditorContextType<S> {
  // Localisation:
  t: TFunction;

  // Modals management:
  modal: ModalRequest<unknown, unknown> | null;
  openModal: <ArgumentsType, SubmitArgumentsType>(
    request: ModalRequest<ArgumentsType, SubmitArgumentsType>
  ) => void;
  closeModal: () => void;

  // Tool logic:
  activeTool: Tool<S>;
  state: S;
  setState: (state: S) => void;

  // Switching tool:
  switchTool: <NewToolState extends CommonToolState>(
    tool: Tool<NewToolState>,
    state?: Partial<NewToolState>
  ) => void;
}

export interface ExtendedEditorContextType<S> extends EditorContextType<S> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dispatch: Dispatch<any>;
  editorState: EditorState;
  mapState: {
    mapStyle: string;
    viewport: ViewportProps;
  };
}

export type ReadOnlyEditorContextType<S> = Omit<
  ExtendedEditorContextType<S>,
  'setState' | 'openModal' | 'closeModal'
> & {
  editorState: EditorState;
};

// UTILS
export type MakeOptional<Type, Key extends keyof Type> = Omit<Type, Key> & Partial<Pick<Type, Key>>;

export interface CommonToolState {
  mousePosition: [number, number] | null;
  hovered: PositionnedItem | null;
}

export const DEFAULT_COMMON_TOOL_STATE: CommonToolState = {
  mousePosition: null,
  hovered: null,
};

export interface ToolAction<S> {
  id: string;
  icon: ComponentType;
  labelTranslationKey: string;
  // Tool appearance:
  isActive?: (context: ReadOnlyEditorContextType<S>) => boolean;
  isHidden?: (context: ReadOnlyEditorContextType<S>) => boolean;
  isDisabled?: (context: ReadOnlyEditorContextType<S>) => boolean;
  // On click button:
  onClick?: (context: ExtendedEditorContextType<S>) => void;
}

export interface Tool<S> {
  id: string;
  icon: IconType;
  labelTranslationKey: string;
  actions: ToolAction<S>[][];
  getInitialState: () => S;
  isDisabled?: (context: ReadOnlyEditorContextType<S>) => boolean;
  getRadius?: (context: ReadOnlyEditorContextType<S>) => number;

  // Interactions with Mapbox:
  onClickMap?: (e: MapEvent, context: ExtendedEditorContextType<S>) => void;
  onClickFeature?: (feature: Item, e: MapEvent, context: ExtendedEditorContextType<S>) => void;
  onHover?: (e: MapEvent, context: ExtendedEditorContextType<S>) => void;
  onMove?: (e: MapEvent, context: ExtendedEditorContextType<S>) => void;
  onKeyDown?: (e: KeyboardEvent, context: ExtendedEditorContextType<S>) => void;
  getCursor?: (
    context: ExtendedEditorContextType<S>,
    mapState: { isLoaded: boolean; isDragging: boolean; isHovering: boolean }
  ) => string;

  // Display:
  getInteractiveLayers?: (context: ReadOnlyEditorContextType<S>) => string[];
  layersComponent?: ComponentType;
  leftPanelComponent?: ComponentType;
  messagesComponent?: ComponentType;
}
