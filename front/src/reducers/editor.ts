import produce from 'immer';
import { createSelector } from 'reselect';
import { Feature, FeatureCollection, GeoJSON } from 'geojson';

import { ThunkAction, Zone, ApiInfrastructure, EditorSchema } from '../types';
import { setLoading, setSuccess, setFailure } from './main';
import { getEditorSchema, getEditorData, editorSave } from '../applications/editor/data/api';
import { clip } from '../utils/mapboxHelper';

//
// Actions
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
const SELECT_ZONE = 'editor/SELECT_ZONE';
type ActionSelectZone = {
  type: typeof SELECT_ZONE;
  zone: Zone | null;
  layers: Array<string>;
};
export function selectZone(
  layers: Array<string>,
  zone: Zone | null
): ThunkAction<ActionSelectZone> {
  return async (dispatch: any, getState) => {
    dispatch({
      type: SELECT_ZONE,
      zone,
    });
    // load the data
    if (zone) {
      dispatch(setLoading());
      try {
        const { osrdconf } = getState();
        const data = await getEditorData(osrdconf.infraID, layers, zone);
        dispatch(setSuccess());
        dispatch(setEditorData(data));
      } catch (e) {
        dispatch(setFailure(e as Error));
      }
    }
  };
}

//
// When the selected data are loaded, we store them in the state
//
const SET_DATA = 'editor/SET_DATA';
type ActionSetData = {
  type: typeof SET_DATA;
  data: { [layer: string]: Array<Feature> };
};
export function setEditorData(data: {
  [layer: string]: Array<Feature>;
}): ThunkAction<ActionSetData> {
  return (dispatch) => {
    dispatch({
      type: SET_DATA,
      data,
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

const CREATE_ENTITY = 'editor/CREATE_ENTITY';
type ActionCreateEntity = { type: typeof CREATE_ENTITY; layer: string; data: Feature };
export function createEntity(layer: string, data: Feature): ThunkAction<ActionCreateEntity> {
  return (dispatch) => {
    dispatch({
      type: CREATE_ENTITY,
      layer,
      data,
    });
    dispatch(save());
  };
}

const UPDATE_ENTITY = 'editor/UPDATE_ENTITY';
type ActionUpdateEntity = { type: typeof UPDATE_ENTITY; item: Feature };
export function updateEntity(item: Feature): ThunkAction<ActionUpdateEntity> {
  return (dispatch) => {
    dispatch({
      type: UPDATE_ENTITY,
      item,
    });
    dispatch(save());
  };
}

const DELETE_ENTITY = 'editor/DELETE_ENTITY';
type ActionDeleteEntities = { type: typeof DELETE_ENTITY; items: Array<Feature> };
export function deleteEntities(items: Array<Feature>): ThunkAction<ActionDeleteEntities> {
  //TODO
  console.log(items);
  return (dispatch) => {
    // entities.forEach((entity) => {
    //   entity.delete();
    //   dispatch({
    //     type: DELETE_ENTITY,
    //     entity,
    //   });
    // });
    dispatch(save());
  };
}

const SAVE = 'editor/SAVE';
type ActionSave = {
  type: typeof SAVE;
};
export function save(): ThunkAction<ActionSave> {
  return async (dispatch, getState) => {
    const state = getState();
    dispatch(setLoading());
    try {
      // TODO state.editor.editorEntities
      await editorSave(state.editor.editorInfrastructure.id, []);
      // dispatch(setEditorData(data));
      dispatch(
        setSuccess({
          title: 'Modifications enregistrées',
          text: `Vos modifications ont été publiées`,
        })
      );
      // TODO: parse the response and update the  state.editor.editorEntities
    } catch (e) {
      dispatch(setFailure(e as Error));
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
  editorData: { [layer: string]: Array<Feature> };
}

export const initialState: EditorState = {
  // Definition of entities (json schema)
  editorSchema: {},
  // ID of selected layers on which we are working
  editorLayers: ['track_sections'],
  // Edition zone:
  editorZone: null,
  // An array of Entities per layer
  editorData: {},
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
      // case CREATE_ENTITY:
      //   draft.editorEntities = state.editorEntities.concat(action.entity);
      // break;
      // The following cases are commented because they apparently don't apply
      // with the current state of typings:
      case SET_DATA:
        draft.editorData = action.data;
        break;
      // case UPDATE_ENTITY:
      // case DELETE_ENTITY:
      //   draft.editorEntities = state.editorEntities
      //     .filter((item) => item.entity_id !== action.entity.entity_id)
      //     .concat(action.entity);
      //   break;
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
  let result: Array<FeatureCollection> = [];
  if (zone && data)
    result = Object.keys(data).map((layer) => ({
      type: 'FeatureCollection',
      features: data[layer].map((f) => clip(f, zone)).filter((e) => e !== null),
    })) as Array<FeatureCollection>;

  return result;
});
