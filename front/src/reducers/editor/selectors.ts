import { EditorState } from 'applications/editor/tools/types';
import { RootState } from 'reducers';
import { makeSubSelector } from 'utils/selectors';

export const getEditorState = (state: RootState) => state.editor;
const makeEditorSelector = makeSubSelector<EditorState>(getEditorState);

export const getEditorIssue = makeEditorSelector('issues');
