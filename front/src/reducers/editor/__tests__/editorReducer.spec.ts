import { EditorState } from 'applications/editor/tools/types';
import { createStoreWithoutMiddleware } from 'Store';
import editorTestDataBuilder from './editorTestDataBuilder';
import {
  editorInitialState,
  selectLayers,
  editorSlice,
  loadDataModelAction,
  updateTotalsIssueAction,
  updateFiltersIssueAction,
} from '..';

const createStore = (initialStateExtra?: EditorState) =>
  createStoreWithoutMiddleware({
    [editorSlice.name]: initialStateExtra,
  });

describe('editorReducer', () => {
  const testDataBuilder = editorTestDataBuilder();
  it('should return initial state', () => {
    const store = createStore();
    const editorState = store.getState()[editorSlice.name];
    expect(editorState).toEqual(editorInitialState);
  });

  it('should handle selectLayers', () => {
    const store = createStore();
    const editorLayers = testDataBuilder.buildEditorLayers(['catenaries', 'routes']);
    store.dispatch(selectLayers(editorLayers));
    const editorState = store.getState()[editorSlice.name];
    expect(editorState.editorLayers).toEqual(new Set(['catenaries', 'routes']));
  });

  describe('should handle loadDataModelAction', () => {
    it('should have empty array initially', () => {
      const store = createStore();
      const editorState = store.getState()[editorSlice.name];
      expect(editorState.editorSchema).toEqual([]);
    });

    it('should update editorSchema', () => {
      const store = createStore();
      const editorSchema = testDataBuilder.buildEditorSchema();
      store.dispatch(loadDataModelAction(editorSchema));
      const editorState = store.getState()[editorSlice.name];
      expect(editorState.editorSchema).toEqual(editorSchema);
    });
  });

  it('should handle updateTotalIssueAction', () => {
    const store = createStore();
    const newIssues = testDataBuilder.buildTotalIssue(5, 10);
    store.dispatch(updateTotalsIssueAction(newIssues));
    const editorState = store.getState()[editorSlice.name];
    expect(editorState.issues).toEqual({ ...editorInitialState.issues, ...newIssues });
  });

  it('should handle updateFiltersIssueAction', () => {
    const store = createStore();
    const newIssues = testDataBuilder.buildFilterIssue('warnings', 'empty_object');
    store.dispatch(updateFiltersIssueAction(newIssues));
    const editorState = store.getState()[editorSlice.name];
    expect(editorState.issues).toEqual({ ...editorInitialState.issues, ...newIssues });
  });
});
