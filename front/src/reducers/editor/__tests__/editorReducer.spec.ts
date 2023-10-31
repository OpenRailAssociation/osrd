import { createStoreWithoutMiddleware } from 'store';
import { editorInitialState, editorSliceActions, editorSlice } from 'reducers/editor';
import editorTestDataBuilder from './editorTestDataBuilder';

const { selectLayers, loadDataModelAction, updateTotalsIssueAction, updateFiltersIssueAction } =
  editorSliceActions;

const createStore = () =>
  createStoreWithoutMiddleware({
    [editorSlice.name]: editorInitialState,
  });
let store: ReturnType<typeof createStore>;

beforeEach(() => {
  store = createStore();
});

const testDataBuilder = editorTestDataBuilder();

describe('editorReducer', () => {
  it('should return initial state', () => {
    const editorState = store.getState()[editorSlice.name];
    expect(editorState).toEqual(editorInitialState);
  });

  it('should handle selectLayers', () => {
    const editorLayers = testDataBuilder.buildEditorLayers(['catenaries', 'routes']);
    store.dispatch(selectLayers(editorLayers));
    const editorState = store.getState()[editorSlice.name];
    expect(editorState.editorLayers).toEqual(new Set(['catenaries', 'routes']));
  });

  it('should handle loadDataModelAction and update editorSchema', () => {
    const editorSchema = testDataBuilder.buildEditorSchema();
    store.dispatch(loadDataModelAction(editorSchema));
    const editorState = store.getState()[editorSlice.name];
    expect(editorState.editorSchema).toEqual(editorSchema);
  });

  it('should handle updateTotalIssueAction', () => {
    const newIssues = testDataBuilder.buildTotalIssue(5, 10);
    store.dispatch(updateTotalsIssueAction(newIssues));
    const editorState = store.getState()[editorSlice.name];
    expect(editorState.issues).toEqual({ ...editorInitialState.issues, ...newIssues });
  });

  it('should handle updateFiltersIssueAction', () => {
    const newIssues = testDataBuilder.buildFilterIssue('warnings', 'empty_object');
    store.dispatch(updateFiltersIssueAction(newIssues));
    const editorState = store.getState()[editorSlice.name];
    expect(editorState.issues).toEqual({ ...editorInitialState.issues, ...newIssues });
  });

  it('should handle updateInfraIDAction', () => {
    store.dispatch(editorSliceActions.updateInfraID(15));
    const editorState = store.getState()[editorSlice.name];
    expect(editorState.infraID).toEqual(15);
  });
});
