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
  getEditorLayers,
  saveEditorOperations,
} from '../applications/editor/api';
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
  return async (dispatch: any) => {
    dispatch({
      type: SELECT_ZONE,
      zone,
    });
    // load the data
    if (zone) {
      dispatch(setLoading());
      try {
        const data = await getEditorLayers(infra, layers, zone);
        dispatch(setSuccess());
        dispatch(setEditorData(data));
        dispatch(loadDataModel());
      } catch (e) {
        dispatch(setFailure(e));
      }
    }
  };
}

//
// When the selected data are loaded, we store them in the state
//
const SELECTED_ZONE_LOADED = 'editor/SELECTED_ZONE_LOADED';
type ActionSelectedZoneLoaded = {
  type: typeof SELECTED_ZONE_LOADED;
  data: Array<GeoJSON> | null;
};
export function setEditorData(geojsons: Array<GeoJSON>): ThunkAction<ActionSelectedZoneLoaded> {
  return (dispatch) => {
    dispatch({
      type: SELECTED_ZONE_LOADED,
      data: geojsons,
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
      !getState().editor.editorEntitiesDefinintion ||
      !getState().editor.editorComponentsDefinintion
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

const CREATE_LINE = 'editor/CREATE_LINE';
type ActionCreateLine = { type: typeof CREATE_LINE; feature: Feature };
export function createLine(line: Path, entity: Entity): ThunkAction<ActionCreateLine> {
  return (dispatch) => {
    const geometry = {
      type: 'LineString',
      coordinates: line,
    };
    dispatch({
      type: CREATE_LINE,
      feature: {
        type: 'Feature',
        properties: entity.toObject(),
        geometry: geometry,
      },
    });
    // add the geo component
    entity.components.push({
      component_type: 'geo_line_location',
      geographic: geometry,
      schematic: geometry,
    });
    dispatch(addOperations(entity.toOperations()));
  };
}

const ADD_OPERATIONS = 'editor/ADD_OPERATIONS';
type ActionAddOperations = {
  type: typeof ADD_ADD_OPERATIONS;
  operation: EditorOperation;
};
export function addOperations(
  operations: array<EditorOperation>,
): ThunkAction<ActionAddOperations> {
  return (dispatch) => {
    dispatch({
      type: ADD_OPERATIONS,
      operations,
    });
    // TODO: need to be triggered from an other way
    dispatch(saveOperations());
  };
}

const CLEAR_OPERATIONS = 'editor/CLEAR_OPERATIONS';
type ActionClearOperations = {
  type: typeof CLEAR_OPERATIONS;
};
export function clearOperations(): ThunkAction<ActionClearOperations> {
  return (dispatch) => {
    dispatch({
      type: CLEAR_OPERATIONS,
    });
  };
}

const SAVE_OPERATIONS = 'editor/SAVE_OPERATIONS';
type ActionSaveOperations = {
  type: typeof SAVE_OPERATIONS;
};
export function saveOperations(): ThunkAction<ActionSaveOperations> {
  return async (dispatch, getState) => {
    const state = getState();
    dispatch(setLoading());
    try {
      const data = await saveEditorOperations(
        state.editor.editorInfrastructure.id,
        state.editor.editorOperations,
      );
      dispatch(
        setSuccess({
          title: 'Modifications enregistrées',
          text: `Vos ${state.editor.editorOperations.length} modifications ont été publiées`,
        }),
      );
      dispatch(clearOperations());
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
  | ActionCreateLine
  | ActionAddOperation
  | ActionSaveOperations
  | ActionClearOperations;

//
// State definition
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
export interface EditorState {
  editorEntitiesDefinintion: EditorEntitiesDefinition | null;
  editorComponentsDefinition: EditorComponentsDefinition | null;
  editorInfrastructure: ApiInfrastructure | null;
  editorLayers: Array<string>;
  editorZone: Zone | null;
  editorData: Array<GeoJSON> | null;
  editorOperations: Array<EditorOperation>;
}

export const initialState: EditorState = {
  // Definition of the composition of an entity, ie. it's list of components
  editorEntitiesDefinintion: null,
  // Definition of component, ie. it's list of fields with theirs types, and if they are required
  editorComponentsDefinition: null,
  // ID of the infrastructure on which we are working
  editorInfrastructure: null,
  // ID of selected layers on which we are working
  editorLayers: ['osrd_track_section', 'osrd_signal', 'map_midi_circuitdevoie'],
  // Edition zone:
  editorZone: null,
  // Data of the edition zone
  // An array of GeoJSONs (one per layer)
  editorData: null,
  // List of modification operation
  editorOperations: [],
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
      case SELECTED_ZONE_LOADED:
        draft.editorData = action.data;
        break;
      case CREATE_LINE:
        const layers = state.editorData || [];
        const layer = layers[0] as FeatureCollection | null;
        draft.editorData = layer
          ? [
              {
                ...layer,
                features: layer.features.concat([action.feature]),
                // @ts-ignore
                count: layer.count + 1,
              },
              ...layers.slice(1),
            ]
          : [{ type: 'FeatureCollection', count: 1, features: action.feature }];
        break;
      case ADD_OPERATIONS:
        draft.editorOperations = state.editorOperations.concat(action.operations);
        break;
      case CLEAR_OPERATIONS:
        draft.editorOperations = [];
        break;
      case LOAD_DATA_MODEL:
        draft.editorEntitiesDefinintion = action.data.entities;
        draft.editorComponentsDefinition = action.data.components;
        break;
    }
  });
}

//
// Derived data selector
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
export const dataSelector = (state: EditorState) => state.editorData;
export const zoneSelector = (state: EditorState) => state.editorZone;
export const clippedDataSelector = createSelector(dataSelector, zoneSelector, (data, zone) => {
  return zone && data
    ? data.map((geoJSON) => clip(geoJSON as FeatureCollection, zone) as FeatureCollection)
    : [];
});
