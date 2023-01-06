import { ComponentType } from 'react';
import { Dispatch } from 'redux';
import { ViewState } from 'react-map-gl';
import { IconType } from 'react-icons/lib/esm/iconBase';
import { TFunction } from 'i18next';
import { reduce } from 'lodash';

import { Feature } from 'geojson';
import { EditorEntity, EditorSchema, SwitchType, MapLayerMouseEvent } from '../../../types';

export interface EditorState {
  editorSchema: EditorSchema;
  editorLayers: Set<LayerType>;
}

export const LAYERS = [
  'track_sections',
  'signals',
  'buffer_stops',
  'detectors',
  'switches',
] as const;
export const LAYERS_SET: Set<string> = new Set(LAYERS);
export type LayerType = typeof LAYERS[number];

export const EDITOAST_TYPES = [
  'TrackSection',
  'Signal',
  'BufferStop',
  'Detector',
  'Switch',
] as const;
export const EDITOAST_TYPES_SET: Set<string> = new Set(EDITOAST_TYPES);
export type EditoastType = typeof EDITOAST_TYPES[number];

export const EDITOAST_TO_LAYER_DICT: Record<EditoastType, LayerType> = {
  TrackSection: 'track_sections',
  Signal: 'signals',
  BufferStop: 'buffer_stops',
  Detector: 'detectors',
  Switch: 'switches',
};
export const LAYER_TO_EDITOAST_DICT = reduce(
  EDITOAST_TO_LAYER_DICT,
  (iter, value, key) => ({
    ...iter,
    [value]: key,
  }),
  {}
) as Record<LayerType, EditoastType>;

export interface MapState {
  mapStyle: string;
  viewport: ViewState;
}
export interface OSRDConf {
  infraID: string | number | undefined;
  switchTypes: SwitchType[] | null;
}

export interface ModalProps<
  ArgumentsType = Record<string, unknown>,
  SubmitArgumentsType = Record<string, unknown>
> {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface EditorContextType<S = any> {
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
  setState: (state: Partial<S>) => void;

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
  mapState: MapState;
  osrdConf: OSRDConf;
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
  hovered: { type: EditoastType; id: string; renderedEntity: Feature } | null;
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
  getInitialState: (context: { osrdConf: OSRDConf }) => S;
  requiredLayers?: Set<LayerType>;
  isDisabled?: (context: ReadOnlyEditorContextType<S>) => boolean;

  // Interactions with Mapbox:
  onMount?: (context: ExtendedEditorContextType<S>) => void;
  onUnmount?: (context: ExtendedEditorContextType<S>) => void;
  onClickMap?: (e: MapLayerMouseEvent, context: ExtendedEditorContextType<S>) => void;
  onClickEntity?: (
    entity: EditorEntity,
    e: MapLayerMouseEvent,
    context: ExtendedEditorContextType<S>
  ) => void;
  onHover?: (e: MapLayerMouseEvent, context: ExtendedEditorContextType<S>) => void;
  onMove?: (e: MapLayerMouseEvent, context: ExtendedEditorContextType<S>) => void;
  onKeyDown?: (e: KeyboardEvent, context: ExtendedEditorContextType<S>) => void;
  getCursor?: (
    context: ExtendedEditorContextType<S>,
    mapState: { isLoaded: boolean; isDragging: boolean; isHovering: boolean }
  ) => string;

  // Display:
  getInteractiveLayers?: (context: ReadOnlyEditorContextType<S>) => string[];
  layersComponent?: ComponentType<{ map: mapboxgl.Map }>;
  leftPanelComponent?: ComponentType;
  messagesComponent?: ComponentType;
}

export type FullTool<S> = {
  tool: Tool<S>;
  state: S;
};
