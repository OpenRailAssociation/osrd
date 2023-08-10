import produce from 'immer';
import { Feature } from 'geojson';
import { without, omit, clone } from 'lodash';

import { JSONSchema7, JSONSchema7Definition } from 'json-schema';
import { osrdEditoastApi } from '../common/api/osrdEditoastApi';
import { ThunkAction, EditorSchema, EditorEntity } from '../types';
import { setLoading, setSuccess, setFailure } from './main';
import { EditorState, LAYERS, LayerType } from '../applications/editor/tools/types';
import {
  entityToCreateOperation,
  entityToUpdateOperation,
  entityToDeleteOperation,
} from '../applications/editor/data/utils';
import infra_schema from './osrdconf/infra_schema.json';

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
        const schemaResponse = infra_schema as JSONSchema7;
        // parse the schema
        const fieldToOmit = ['id', 'geo', 'sch'];
        const schema = Object.keys(schemaResponse.properties || {})
          .filter((e: string) => {
            const property: JSONSchema7Definition | undefined = schemaResponse?.properties?.[e];
            return typeof property !== 'boolean' && property && property.type === 'array';
          })
          .map((e: string) => {
            // we assume here, that the definition of the object is ref and not inline
            const property: JSONSchema7 | undefined = schemaResponse?.properties?.[
              e
            ] as JSONSchema7;
            const items = property.items as JSONSchema7;
            type keys = keyof typeof items.$ref;
            const ref = items?.$ref?.split('/') as keys;
            const refTarget = clone(schemaResponse[ref[1]][ref[2]]) as JSONSchema7;
            refTarget.properties = omit(refTarget.properties, fieldToOmit);
            refTarget.required = (refTarget.required || []).filter(
              (field: string) => !fieldToOmit.includes(field)
            );
            return {
              layer: e,
              objType: ref[2],
              schema: {
                ...refTarget,
                [ref[1]]: schemaResponse[ref[1]],
              },
            } as EditorSchema[0];
          });
        dispatch(setSuccess());
        dispatch({
          type: LOAD_DATA_MODEL,
          schema,
        });
      } catch (e) {
        console.error(e);
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
      const payload = [
        ...(operations.create || []).map((e) => entityToCreateOperation(e)),
        ...(operations.update || []).map((e) => entityToUpdateOperation(e.target, e.source)),
        ...(operations.delete || []).map((e) => entityToDeleteOperation(e)),
      ];

      const response = await dispatch(
        osrdEditoastApi.endpoints.postInfraById.initiate({
          id: state.osrdconf.simulationConf.infraID,
          body: payload,
        })
      );
      if ('data' in response) {
        // success message
        dispatch(
          setSuccess({
            title: 'Modifications enregistrées',
            text: `Vos modifications ont été publiées`,
          })
        );
        return response.data;
      }
      throw new Error(JSON.stringify(response.error));
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
  editorLayers: new Set(['track_sections']),
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
