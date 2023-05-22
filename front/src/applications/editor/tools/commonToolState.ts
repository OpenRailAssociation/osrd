import { Feature } from 'geojson';
import { EditoastType } from './types';

export interface CommonToolState {
  mousePosition: [number, number] | null;
  hovered: { type: EditoastType; id: string; renderedEntity: Feature } | null;
}

export const DEFAULT_COMMON_TOOL_STATE: CommonToolState = {
  mousePosition: null,
  hovered: null,
};
