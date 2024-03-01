import type { CommonToolState } from 'applications/editor/tools/types';
import type { EditorEntity } from 'applications/editor/typesEditorEntity';

export type SelectionState = CommonToolState & {
  selectionState:
    | { type: 'single' }
    | { type: 'polygon'; polygonPoints: [number, number][] }
    | { type: 'rectangle'; rectangleTopLeft: [number, number] | null };
  selection: EditorEntity[];
  isLoading: boolean;
};
