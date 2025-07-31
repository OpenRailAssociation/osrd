import type { RootState } from 'reducers';
import { type EditorState, editorSlice } from 'reducers/editor';
import buildInfraStateSelectors from 'reducers/infra/selectors';
import { makeSubSelector } from 'utils/selectors';

export const getEditorState = (state: RootState) => state.editor;
const makeEditorSelector = makeSubSelector<EditorState>(getEditorState);

export const getEditorIssues = makeEditorSelector('issues');

export const getInfraLockStatus = makeEditorSelector('infraIsLocked');

const selectors = {
  ...buildInfraStateSelectors(editorSlice),
  getEditorState,
  getEditorIssues,
  getEditorLayers: makeEditorSelector('editorLayers'),
  getEditorSchema: makeEditorSelector('editorSchema'),
  getInfraLockStatus,
  getMapSettings: makeEditorSelector('mapSettings'),
};

export type EditorSelectors = typeof selectors;

export default selectors;
