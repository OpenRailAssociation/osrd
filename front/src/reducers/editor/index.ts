import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

import type { InfraErrorLevel } from 'applications/editor/components/InfraErrors';
import type { Layer } from 'applications/editor/consts';
import type { EditorSchema } from 'applications/editor/typesEditorEntity';
import type { InfraErrorTypeLabel } from 'common/api/osrdEditoastApi';
import { type InfraState, buildInfraStateReducers, infraState } from 'reducers/infra';

export interface EditorState extends InfraState {
  editorSchema: EditorSchema;
  editorLayers: Set<Layer>;
  issues: {
    total: number;
    filterTotal: number;
    filterLevel: NonNullable<InfraErrorLevel>;
    filterType: InfraErrorTypeLabel | null;
  };
}

export const editorInitialState: EditorState = {
  // Definition of entities (json schema)
  editorSchema: [],
  // ID of selected layers on which we are working
  editorLayers: new Set(['track_sections', 'errors']),
  // Editor issue management
  issues: {
    total: 0,
    filterTotal: 0,
    filterLevel: 'all',
    filterType: null,
  },
  ...infraState,
};

export const editorSlice = createSlice({
  name: 'editor',
  initialState: editorInitialState,
  reducers: {
    ...buildInfraStateReducers<EditorState>(),
    selectLayers(state, action: PayloadAction<EditorState['editorLayers']>) {
      state.editorLayers = action.payload;
    },
    loadDataModelAction(state, action: PayloadAction<EditorState['editorSchema']>) {
      state.editorSchema = action.payload;
    },
    updateTotalsIssueAction(
      state,
      action: PayloadAction<Pick<EditorState['issues'], 'total' | 'filterTotal'>>
    ) {
      state.issues = {
        ...state.issues,
        ...action.payload,
      };
    },
    updateFiltersIssueAction(
      state,
      action: PayloadAction<Pick<EditorState['issues'], 'filterLevel' | 'filterType'>>
    ) {
      state.issues = {
        ...state.issues,
        ...action.payload,
      };
    },
  },
});
export const editorSliceActions = editorSlice.actions;

export type EditorSliceActions = typeof editorSlice.actions;

export type EditorSlice = typeof editorSlice;

export default editorSlice.reducer;
