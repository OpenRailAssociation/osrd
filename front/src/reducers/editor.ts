import produce from 'immer';
import { flatten, mapValues } from 'lodash';
import { createSelector } from 'reselect';
import { Feature } from 'geojson';

import { ThunkAction, Zone, EditorSchema, EditorEntity } from '../types';
import { setLoading, setSuccess, setFailure } from './main';
import { getEditorSchema, getEditorData, editorSave } from '../applications/editor/data/api';
import { clip } from '../utils/mapboxHelper';
import { EditorState, LAYERS, LayerType } from '../applications/editor/tools/types';
import { flattenEntity } from '../applications/editor/data/utils';

//
// Actions
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// When the selected data are loaded, we store them in the state
//
const SET_DATA = 'editor/SET_DATA';
type ActionSetData = {
  type: typeof SET_DATA;
  entitiesByType: Partial<Record<LayerType, EditorEntity[]>>;
};
export function setEditorData(data: ActionSetData['entitiesByType']): ThunkAction<ActionSetData> {
  return (dispatch) => {
    dispatch({
      type: SET_DATA,
      entitiesByType: data,
    });
  };
}

const RELOAD_DATA = 'editor/RELOAD_DATA';
type ActionReloadData = {
  type: typeof RELOAD_DATA;
};
export function reloadData(): ThunkAction<ActionReloadData> {
  return async (dispatch, getState) => {
    const {
      editor,
      osrdconf: { infraID },
    } = getState();
    const { editorSchema, editorLayers, editorZone } = editor as EditorState;

    if (!editorZone || !editorSchema || !editorLayers) {
      dispatch(setEditorData({}));
    } else {
      dispatch(setLoading());
      try {
        const data = await getEditorData(editorSchema, infraID, editorLayers, editorZone);
        dispatch(setSuccess());
        dispatch(setEditorData(data));
      } catch (e) {
        dispatch(setFailure(e as Error));
      }
    }
  };
}

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

const SELECT_ZONE = 'editor/SELECT_ZONE';
type ActionSelectZone = {
  type: typeof SELECT_ZONE;
  zone: Zone | null;
};
export function selectZone(zone: ActionSelectZone['zone']): ThunkAction<ActionSelectZone> {
  return (dispatch) => {
    dispatch({
      type: SELECT_ZONE,
      zone,
    });

    dispatch(reloadData());
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

    dispatch(reloadData());
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
      const savedFeatures = await editorSave(state.osrdconf.infraID, operations);
      // reload the zone
      dispatch(selectZone(state.editor.editorZone));
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

export type EditorActions =
  | ActionSelectZone
  | ActionLoadDataModel
  | ActionSave
  | ActionSetData
  | ActionReset
  | ActionSelectLayers;

//
// State definition
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
export const initialState: EditorState = {
  // Definition of entities (json schema)
  editorSchema: [],
  // ID of selected layers on which we are working
  editorLayers: new Set(LAYERS),
  // Edition zone:
  editorZone: null,
  // Editor entities:
  flatEntitiesByTypes: {},
  entitiesArray: [],
  entitiesIndex: {},
};

//
// State reducer
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
export default function reducer(inputState: EditorState | undefined, action: EditorActions) {
  const state = inputState || initialState;

  return produce(state, (draft) => {
    switch (action.type) {
      case SELECT_ZONE:
        draft.editorZone = action.zone;
        break;
      case SELECT_LAYERS:
        draft.editorLayers = action.layers;
        break;
      case LOAD_DATA_MODEL:
        draft.editorSchema = action.schema;
        break;
      case SET_DATA:
        draft.flatEntitiesByTypes = mapValues(
          action.entitiesByType,
          (entitiesArray: EditorEntity[]) => entitiesArray.map(flattenEntity)
        );
        draft.entitiesArray = flatten(Object.values(action.entitiesByType));
        draft.entitiesIndex = draft.entitiesArray.reduce(
          (iter, entity) => ({ ...iter, [entity.properties.id]: entity }),
          {}
        );
        break;
      case RESET:
        draft.editorLayers = initialState.editorLayers;
        draft.editorZone = initialState.editorZone;
        draft.flatEntitiesByTypes = initialState.flatEntitiesByTypes;
        draft.entitiesArray = initialState.entitiesArray;
        draft.entitiesIndex = initialState.entitiesIndex;
        // The schema is preserved, because it never changes at the moment.
        break;
      default:
        // Nothing to do here
        break;
    }
  });
}

//
// Derived data selector
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
export const flatEntitiesSelector = (state: EditorState) => state.flatEntitiesByTypes;
export const dataArraySelector = (state: EditorState) => state.entitiesArray;
export const zoneSelector = (state: EditorState) => state.editorZone;
export const clippedDataSelector = createSelector(dataArraySelector, zoneSelector, (data, zone) => {
  let result: Array<EditorEntity> = [];
  if (zone && data)
    result = data.map((f) => {
      const clippedFeature = clip(f, zone);
      return clippedFeature ? { ...f, geometry: clippedFeature.geometry } : f;
    });
  return result;
});
