import { makeSubSelector } from 'utils/selectors';

import type { EditorState } from 'applications/editor/tools/types';

import type { RootState } from 'reducers';
import { editorSlice } from 'reducers/editor';
import buildInfraStateSelectors from 'reducers/infra/selectors';

export const getEditorState = (state: RootState) => state.editor;
const makeEditorSelector = makeSubSelector<EditorState>(getEditorState);

export const getEditorIssues = makeEditorSelector('issues');

export const getInfraLockStatus = makeEditorSelector('infraIsLocked');

const selectors = {
  ...buildInfraStateSelectors(editorSlice),
  getEditorIssues: makeEditorSelector('issues'),
  getEditorLayers: makeEditorSelector('editorLayers'),
  getEditorSchema: makeEditorSelector('editorSchema'),
  getInfraLockStatus: makeEditorSelector('infraIsLocked'),
};

export type EditorSelectors = typeof selectors;

export default selectors;
