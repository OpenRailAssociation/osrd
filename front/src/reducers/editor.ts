import produce from 'immer';
import { Feature } from 'geojson';
import { without } from 'lodash';

import { ThunkAction, EditorSchema, EditorEntity } from '../types';
import { setLoading, setSuccess, setFailure } from './main';
import { getEditorSchema, editorSave } from '../applications/editor/data/api';
import { EditorState, LAYERS, LayerType } from '../applications/editor/tools/types';

//
// Actions
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// When the selected data are loaded, we store them in the state
//

const RESET = 'editor/RESET';
type ActionReset = {
  type: typeof RESET;
};
export function reset(): ThunkAction<ActionReset> {
  return (dispatch) => {
    dispatch({
      type: RESET,
    });
  };
}

const SELECT_LAYERS = 'editor/SELECT_LAYERS';
type ActionSelectLayers = {
  type: typeof SELECT_LAYERS;
  layers: Set<LayerType>;
};
export function selectLayers(
  layers: ActionSelectLayers['layers']
): ThunkAction<ActionSelectLayers> {
  return (dispatch) => {
    dispatch({
      type: SELECT_LAYERS,
      layers,
    });
  };
}

//
// Verify if the data model definition is already loaded.
// If not we do it and store it in the state
//
const LOAD_DATA_MODEL = 'editor/LOAD_DATA_MODEL';
type ActionLoadDataModel = {
  type: typeof LOAD_DATA_MODEL;
  schema: EditorSchema;
};
export function loadDataModel(): ThunkAction<ActionLoadDataModel> {
  return async (dispatch, getState) => {
    // check if we need to load the model
    if (!Object.keys(getState().editor.editorSchema).length) {
      dispatch(setLoading());
      try {
        const schema = await getEditorSchema();
        dispatch(setSuccess());
        dispatch({
          type: LOAD_DATA_MODEL,
          schema,
        });
      } catch (e) {
        dispatch(setFailure(e as Error));
      }
    }
  };
}

//
// Save modifications
//
const SAVE = 'editor/SAVE';
export type ActionSave = {
  type: typeof SAVE;
  operations: {
    create?: Array<Feature>;
    update?: Array<Feature>;
    delete?: Array<Feature>;
  };
};
export function save(operations: {
  create?: Array<EditorEntity>;
  update?: Array<{ source: EditorEntity; target: EditorEntity }>;
  delete?: Array<EditorEntity>;
}): ThunkAction<ActionSave> {
  return async (dispatch, getState) => {
    const state = getState();
    dispatch(setLoading());
    try {
      // saving the data
      const savedFeatures = await editorSave(state.osrdconf.simulationConf.infraID, operations);
      // success message
      dispatch(
        setSuccess({
          title: 'Modifications enregistrées',
          text: `Vos modifications ont été publiées`,
        })
      );

      return savedFeatures;
    } catch (e) {
      dispatch(setFailure(e as Error));
      throw e;
    }
  };
}

export type EditorActions = ActionLoadDataModel | ActionSave | ActionReset | ActionSelectLayers;

//
// State definition
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
export const initialState: EditorState = {
  // Definition of entities (json schema)
  editorSchema: [],
  // ID of selected layers on which we are working
  editorLayers: new Set(without(LAYERS, 'errors')),
};

//
// State reducer
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
export default function reducer(inputState: EditorState | undefined, action: EditorActions) {
  const state = inputState || initialState;

  return produce(state, (draft) => {
    switch (action.type) {
      case SELECT_LAYERS:
        draft.editorLayers = action.layers;
        break;
      case LOAD_DATA_MODEL:
        draft.editorSchema = action.schema;
        break;
      case RESET:
        draft.editorLayers = initialState.editorLayers;
        // The schema is preserved, because it never changes at the moment.
        break;
      default:
        // Nothing to do here
        break;
    }
  });
}
