import { EditorEntity } from '../../../../types';
import { CommonToolState } from '../commonToolState';

export type SelectionState = CommonToolState & {
  selectionState:
    | { type: 'single' }
    | { type: 'polygon'; polygonPoints: [number, number][] }
    | { type: 'rectangle'; rectangleTopLeft: [number, number] | null };
  selection: EditorEntity[];
  isLoading: boolean;
};
