import { Dispatch } from 'redux';
import { TFunction } from 'i18next';
import { ComponentType } from 'react';
import { IconType } from 'react-icons/lib/esm/iconBase';
import { ViewState } from 'react-map-gl/maplibre';
import { Map, MapLayerMouseEvent } from 'maplibre-gl';

import type { SwitchType } from 'applications/editor/tools/switchEdition/types';
import { ModalContextType } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import type { EditorState } from 'reducers/editor';

import type { Layer } from './consts';
import type { switchProps } from './tools/switchProps';
import type { EditorEntity } from './typesEditorEntity';

export type Reducer<T> = (value: T) => T;
export type PartialOrReducer<T> = Partial<T> | Reducer<T>;

export type MapState = {
  mapStyle: string;
  viewport: ViewState;
};

// EDITOR CONTEXT

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EditorContextType<S = any> = {
  // Localisation:
  t: TFunction;

  // Tool logic:
  activeTool: Tool<S>;
  state: S;
  setState: (stateOrReducer: PartialOrReducer<S>) => void;

  // Switching tool:
  switchTool: (props: switchProps) => void;

  // Listen to this number's updates to rerender on specific cases, such as data
  // suppression:
  forceRender: () => void;
  renderingFingerprint: number;
} & Pick<ModalContextType, 'openModal' | 'closeModal'>;

export type ExtendedEditorContextType<S> = EditorContextType<S> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dispatch: Dispatch<any>;
  editorState: EditorState;
  mapState: MapState;
  infraID: number | undefined;
  switchTypes: SwitchType[] | undefined;
  isLoading?: boolean;
  isFormSubmited?: boolean;
  isInfraLocked?: boolean;
  setIsFormSubmited?: (isSubmit: boolean) => void;
};

export type ReadOnlyEditorContextType<S> = Omit<
  ExtendedEditorContextType<S>,
  'setState' | 'openModal' | 'closeModal'
> & {
  editorState: EditorState;
};

// TOOLS

export type ToolAction<S> = {
  id: string;
  icon: ComponentType;
  labelTranslationKey: string;
  // Tool appearance:
  isActive?: (context: ReadOnlyEditorContextType<S>) => boolean;
  isHidden?: (context: ReadOnlyEditorContextType<S>) => boolean;
  isDisabled?: (context: ReadOnlyEditorContextType<S>) => boolean;
  // On click button:
  onClick?: (context: ExtendedEditorContextType<S>) => void;
};

export type Tool<S> = {
  id: string;
  icon: IconType;
  labelTranslationKey: string;
  actions: ToolAction<S>[][];
  getInitialState: (context: {
    infraID: number | undefined;
    switchTypes: SwitchType[] | undefined;
  }) => S;
  requiredLayers?: Set<Layer>;
  isDisabled?: (context: ReadOnlyEditorContextType<S>) => boolean;

  // Interactions with MapLibre:
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
  getEventsLayers?: (context: ReadOnlyEditorContextType<S>) => string[];
  layersComponent?: ComponentType<{ map: Map }>;
  leftPanelComponent?: ComponentType;
  messagesComponent?: ComponentType;
};

export type FullTool<S> = {
  tool: Tool<S>;
  state: S;
};
