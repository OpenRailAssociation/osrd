import { RootState } from 'reducers';

export const getEditorState = (state: RootState) => state.editor;
export const getEditorIssue = (state: RootState) => state.editor.issues;
