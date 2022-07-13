import { ComponentType } from 'react';
import { MapEvent } from 'react-map-gl';
import { IconType } from 'react-icons/lib/esm/iconBase';

import { Item, PositionnedItem } from '../../../types';
// eslint-disable-next-line import/no-cycle
import { ExtendedEditorContextType, ReadOnlyEditorContextType } from '../context';

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

export type ToolId = 'select-zone' | 'select-items' | 'track-edition' | 'signal-edition';

export interface Tool<S> {
  id: ToolId;
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
