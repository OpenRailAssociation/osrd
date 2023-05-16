import { Dispatch } from 'redux';
import { TFunction } from 'i18next';
import { ComponentType } from 'react';
import { IconType } from 'react-icons/lib/esm/iconBase';
import { ViewState } from 'react-map-gl';
import { ModalContextType } from '../../../common/BootstrapSNCF/ModalSNCF/ModalProvider';

import { EditorEntity, SwitchType, MapLayerMouseEvent } from '../../../types';
import { EditorState, LayerType } from './types';
import { switchProps } from './switchProps';

export type Reducer<T> = (value: T) => T;
export type ValueOrReducer<T> = T | Reducer<T>;
export type PartialOrReducer<T> = Partial<T> | Reducer<T>;

export interface MapState {
  mapStyle: string;
  viewport: ViewState;
}
export interface OSRDConf {
  infraID: number | undefined;
  switchTypes: SwitchType[] | undefined;
}

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

export interface ExtendedEditorContextType<S> extends EditorContextType<S> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dispatch: Dispatch<any>;
  editorState: EditorState;
  mapState: MapState;
  infraID: number | undefined;
  switchTypes: SwitchType[] | undefined;
}

export type ReadOnlyEditorContextType<S> = Omit<
  ExtendedEditorContextType<S>,
  'setState' | 'openModal' | 'closeModal'
> & {
  editorState: EditorState;
};

// UTILS
export type MakeOptional<Type, Key extends keyof Type> = Omit<Type, Key> & Partial<Pick<Type, Key>>;

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
  getInitialState: (context: {
    infraID: number | undefined;
    switchTypes: SwitchType[] | undefined;
  }) => S;
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
