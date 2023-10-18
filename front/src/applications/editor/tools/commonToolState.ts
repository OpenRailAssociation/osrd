import { Feature } from 'geojson';
import { EditoastType } from './types';
import { InfraError } from '../components/InfraErrors/types';

export interface CommonToolState {
  mousePosition: [number, number] | null;
  hovered: {
    type: EditoastType;
    id: string;
    renderedEntity: Feature;
    error?: InfraError['information'];
  } | null;
}

export const DEFAULT_COMMON_TOOL_STATE: CommonToolState = {
  mousePosition: null,
  hovered: null,
};
