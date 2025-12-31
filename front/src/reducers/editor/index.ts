import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

import type { InfraErrorLevel } from 'applications/editor/components/InfraErrors';
import type { InfraErrorTypeLabel } from 'applications/editor/components/InfraErrors/types';
import type { EditorSchema } from 'applications/editor/typesEditorEntity';
import { buildMapStateReducer, defaultMapSettings } from 'reducers/commonMap';
import type { MapSettings, Viewport } from 'reducers/commonMap/types';
import { type InfraState, buildInfraStateReducers, infraState } from 'reducers/infra';

export type EditorState = InfraState & {
  editorSchema: EditorSchema;
  mapSettings: MapSettings;
  issuesSettings?: {
    types: Array<InfraErrorTypeLabel>;
  };
  issues: {
    total: number;
    filterTotal: number;
    filterLevel: NonNullable<InfraErrorLevel>;
    filterType: InfraErrorTypeLabel | null;
  };
};

export const editorInitialState: EditorState = {
  // Definition of entities (json schema)
  editorSchema: [],
  mapSettings: defaultMapSettings,
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
    ...buildMapStateReducer<EditorState>(),
    updateEditorViewportAction: (state, action: PayloadAction<Partial<Viewport>>) => {
      state.mapSettings.viewport = { ...state.mapSettings.viewport, ...action.payload };
    },
    updateIssuesSettings: (state, action: PayloadAction<EditorState['issuesSettings']>) => {
      state.issuesSettings = action.payload;
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

export const {
  updateIssuesSettings,
  loadDataModelAction,
  updateTotalsIssueAction,
  updateFiltersIssueAction,
} = editorSliceActions;

export type EditorSliceActions = typeof editorSlice.actions;

export type EditorSlice = typeof editorSlice;

export default editorSlice.reducer;
