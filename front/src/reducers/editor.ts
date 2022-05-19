import produce from 'immer';
import { createSelector } from 'reselect';
import { Feature } from 'geojson';

import { ThunkAction, Zone, EditorSchema, EditorEntity } from '../types';
import { setLoading, setSuccess, setFailure } from './main';
import { getEditorSchema, getEditorData, editorSave } from '../applications/editor/data/api';
import { clip } from '../utils/mapboxHelper';

//
// Actions
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// When the selected data are loaded, we store them in the state
//
const SET_DATA = 'editor/SET_DATA';
type ActionSetData = {
  type: typeof SET_DATA;
  data: Array<EditorEntity>;
};
export function setEditorData(data: ActionSetData['data']): ThunkAction<ActionSetData> {
  return (dispatch) => {
    dispatch({
      type: SET_DATA,
      data,
    });
  };
}

const SELECT_ZONE = 'editor/SELECT_ZONE';
type ActionSelectZone = {
  type: typeof SELECT_ZONE;
  zone: Zone | null;
};
export function selectZone(zone: ActionSelectZone['zone']): ThunkAction<ActionSelectZone> {
  return async (dispatch, getState) => {
    dispatch({
      type: SELECT_ZONE,
      zone,
    });
    // load the data
    if (zone) {
      dispatch(setLoading());
      try {
        const { osrdconf, editor } = getState();
        const data = await getEditorData(
          editor.editorSchema,
          osrdconf.infraID,
          editor.editorLayers,
          zone
        );
        dispatch(setSuccess());
        dispatch(setEditorData(data));
      } catch (e) {
        dispatch(setFailure(e as Error));
      }
    }
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
type ActionSave = {
  type: typeof SAVE;
  operations: {
    create?: Array<Feature>;
    update?: Array<Feature>;
    delete?: Array<Feature>;
  };
};
export function save(operations: {
  create?: Array<EditorEntity>;
  update?: Array<EditorEntity>;
  delete?: Array<EditorEntity>;
}): ThunkAction<ActionSave> {
  return async (dispatch, getState) => {
    const state = getState();
    dispatch(setLoading());
    try {
      // saving the data
      await editorSave(state.osrdconf.infraID, operations);
      // reload the zone
      dispatch(selectZone(state.editor.editorZone));
      // success message
      dispatch(
        setSuccess({
          title: 'Modifications enregistrées',
          text: `Vos modifications ont été publiées`,
        })
      );
    } catch (e) {
      dispatch(setFailure(e as Error));
      throw e;
    }
  };
}

type Actions = ActionSelectZone | ActionLoadDataModel | ActionSave | ActionSetData;

//
// State definition
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
export interface EditorState {
  editorSchema: EditorSchema;
  editorLayers: Array<string>;
  editorZone: Zone | null;
  editorData: Array<EditorEntity>;
}

export const initialState: EditorState = {
  // Definition of entities (json schema)
  editorSchema: [],
  // ID of selected layers on which we are working
  editorLayers: ['track_sections'],
  // Edition zone:
  editorZone: null,
  // An array of Entities per layer
  editorData: [],
};

//
// State reducer
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
export default function reducer(inputState: EditorState, action: Actions) {
  const state = inputState || initialState;

  return produce(state, (draft) => {
    switch (action.type) {
      case SELECT_ZONE:
        draft.editorZone = action.zone;
        break;
      case LOAD_DATA_MODEL:
        draft.editorSchema = action.schema;
        break;
      case SET_DATA:
        draft.editorData = action.data;
        break;
      default:
      // Nothing to do here
    }
  });
}

//
// Derived data selector
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
export const dataSelector = (state: EditorState) => state.editorData;
export const zoneSelector = (state: EditorState) => state.editorZone;
export const clippedDataSelector = createSelector(dataSelector, zoneSelector, (data, zone) => {
  let result: Array<EditorEntity> = [];
  if (zone && data)
    result = data.map((f) => {
      const clippedFeature = clip(f, zone);
      return clippedFeature ? { ...f, geometry: clippedFeature.geometry } : f;
    });
  return result;
});
