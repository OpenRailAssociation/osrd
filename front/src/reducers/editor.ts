import produce from 'immer';
import { createSelector } from 'reselect';
import { Feature, FeatureCollection, GeoJSON } from 'geojson';
import {
  ThunkAction,
  Path,
  EditorOperation,
  LineProperties,
  Zone,
  EditorComponentsDefintion,
  EditorEntitiesDefinition,
  ApiInfrastructure,
} from '../types';
import { setLoading, setSuccess, setFailure } from './main';
import {
  getEditorModelDefinition,
  getEditorEntities,
  saveEditorEntities,
} from '../applications/editor/data/api';
import { EntityModel } from '../applications/editor/data/entity';
import { clip } from '../utils/mapboxHelper';

//
// Actions
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
const SELECT_ZONE = 'editor/SELECT_ZONE';
type ActionSelectZone = {
  type: typeof SELECT_ZONE;
  zone: Zone | null;
  infra: number;
  layers: Array<string>;
};
export function selectZone(
  infra: number,
  layers: Array<string>,
  zone: Zone | null,
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
        const { editor } = getState();
        const data = await getEditorEntities(
          infra,
          layers,
          zone,
          editor.editorEntitiesDefinition,
          editor.editorComponentsDefinition,
        );
        dispatch(setSuccess());
        dispatch(setEditorData(data));
      } catch (e) {
        dispatch(setFailure(e));
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
  data: Array<EntityModel>;
};
export function setEditorData(data: Array<EntityModel>): ThunkAction<ActionSetData> {
  return (dispatch) => {
    dispatch({
      type: SET_DATA,
      data,
    });
  };
}

//
// Set the current infrastructure
//
const SET_INFRASTRUCTURE = 'editor/SET_INFRASTRUCTURE';
type ActionSetInfra = {
  type: typeof SET_INFRASTRUCTURE;
  data: ApiInfrastructure;
};
export function setInfrastructure(infra: ApiInfrastructure): ThunkAction<ActionSetInfra> {
  return (dispatch) => {
    dispatch({
      type: SET_INFRASTRUCTURE,
      data: infra,
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
  data: {
    entities: EditorEntitiesDefinition;
    components: EditorComponentsDefintion;
  };
};
export function loadDataModel(): ThunkAction<ActionLoadDataModel> {
  return async (dispatch, getState) => {
    // check if we need to load the model
    if (
      !getState().editor.editorEntitiesDefinition ||
      !getState().editor.editorComponentsDefinition
    ) {
      dispatch(setLoading());
      try {
        const data = await getEditorModelDefinition();
        dispatch(setSuccess());
        dispatch({
          type: LOAD_DATA_MODEL,
          data,
        });
      } catch (e) {
        dispatch(setFailure(e));
      }
    }
  };
}

const CREATE_ENTITY = 'editor/CREATE_ENTITY';
type ActionCreateEntity = { type: typeof CREATE_ENTITY; entity: EntityModel };
export function createEntity(entity: EntityModel): ThunkAction<ActionCreateEntity> {
  return (dispatch) => {
    dispatch({
      type: CREATE_ENTITY,
      entity,
    });
    dispatch(save());
  };
}

const UPDATE_ENTITY = 'editor/UPDATE_ENTITY';
type ActionUpdateEntity = { type: typeof UPDATE_ENTITY; entity: EntityModel };
export function updateEntity(entity: EntityModel): ThunkAction<ActionUpdateEntity> {
  return (dispatch) => {
    dispatch({
      type: UPDATE_ENTITY,
      entity,
    });
    dispatch(save());
  };
}

const DELETE_ENTITY = 'editor/DELETE_ENTITY';
type ActionDeleteEntities = { type: typeof DELETE_ENTITY; entity: EntityModel };
export function deleteEntities(entities: Array<EntityModel>): ThunkAction<ActionDeleteEntities> {
  return (dispatch) => {
    entities.forEach((entity) => {
      entity.delete();
      dispatch({
        type: DELETE_ENTITY,
        entity,
      });
    });
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
      const data = await saveEditorEntities(
        state.editor.editorInfrastructure.id,
        state.editor.editorEntities,
      );
      dispatch(setEditorData(data));
      dispatch(
        setSuccess({
          title: 'Modifications enregistrées',
          text: `Vos modifications ont été publiées`,
        }),
      );
      // TODO: parse the response and update the  state.editor.editorEntities
    } catch (e) {
      dispatch(setFailure(e));
    }
  };
}

type Actions =
  | ActionSelectZone
  | ActionSelectedZoneLoaded
  | ActionLoadDataModel
  | ActionSetInfra
  | ActionCreateEntity
  | ActionSave;

//
// State definition
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
export interface EditorState {
  editorEntitiesDefinition: EditorEntitiesDefinition | null;
  editorComponentsDefinition: EditorComponentsDefinition | null;
  editorInfrastructure: ApiInfrastructure | null;
  editorLayers: Array<string>;
  editorZone: Zone | null;
  editorEntities: Array<EntityModel>;
}

export const initialState: EditorState = {
  // Definition of the composition of an entity, ie. it's list of components
  editorEntitiesDefinition: null,
  // Definition of component, ie. it's list of fields with theirs types, and if they are required
  editorComponentsDefinition: null,
  // ID of the infrastructure on which we are working
  editorInfrastructure: null,
  // ID of selected layers on which we are working
  editorLayers: ['track_sections'],
  // Edition zone:
  editorZone: null,
  // An array of Entities
  editorEntities: [],
};

//
// State reducer
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
export default function reducer(state = initialState, action: Actions) {
  return produce(state, (draft) => {
    switch (action.type) {
      case SET_INFRASTRUCTURE:
        draft.editorInfrastructure = action.data;
      case SELECT_ZONE:
        draft.editorZone = action.zone;
        break;
      case SET_DATA:
        draft.editorEntities = action.data;
        break;
      case CREATE_ENTITY:
        draft.editorEntities = state.editorEntities.concat(action.entity);
        break;
      case UPDATE_ENTITY:
      case DELETE_ENTITY:
        draft.editorEntities = state.editorEntities
          .filter((item) => item.entity_id !== action.entity.entity_id)
          .concat(action.entity);
        break;
      case LOAD_DATA_MODEL:
        draft.editorEntitiesDefinition = action.data.entities;
        draft.editorComponentsDefinition = action.data.components;
        break;
    }
  });
}

//
// Derived data selector
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
export const dataSelector = (state: EditorState) => state.editorEntities;
export const zoneSelector = (state: EditorState) => state.editorZone;
export const clippedDataSelector = createSelector(dataSelector, zoneSelector, (data, zone) => {
  if (zone && data) {
    return [
      {
        type: 'FeatureCollection',
        features: data.map((entity: EntityModel) => clip(entity.toGeoJSON(), zone)),
      } as FeatureCollection,
    ];
  } else {
    return [];
  }
});
