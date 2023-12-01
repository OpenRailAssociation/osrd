import { Feature } from 'geojson';
import { omit, clone, isNil, isUndefined } from 'lodash';
import { JSONSchema7, JSONSchema7Definition } from 'json-schema';
import type { AnyAction, Dispatch, PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import { setLoading, setSuccess, setFailure, setSuccessWithoutMessage } from 'reducers/main';
import { updateIssuesSettings } from 'reducers/map';
import { Operation, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { ThunkAction, EditorSchema, EditorEntity } from 'types';
import {
  allInfraErrorTypes,
  infraErrorTypeList,
} from 'applications/editor/components/InfraErrors/types';
import { EditorState } from 'applications/editor/tools/types';
import {
  entityToCreateOperation,
  entityToUpdateOperation,
  entityToDeleteOperation,
} from 'applications/editor/data/utils';
import i18next from 'i18next';
import infra_schema from '../osrdconf/infra_schema.json';

export const editorInitialState: EditorState = {
  // Definition of entities (json schema)
  editorSchema: [],
  // ID of selected layers on which we are working
  editorLayers: new Set(['track_sections', 'errors']),
  // Editor issue management
  issues: {
    total: 0,
    filterTotal: 0,
    filterLevel: 'all',
    filterType: null,
  },
};

export const editorSlice = createSlice({
  name: 'editor',
  initialState: editorInitialState,
  reducers: {
    selectLayers(state, action: PayloadAction<EditorState['editorLayers']>) {
      state.editorLayers = action.payload;
    },
    loadDataModelAction(state, action: PayloadAction<EditorState['editorSchema']>) {
      state.editorSchema = action.payload;
    },
    updateTotalsIssueAction(
      state,
      action: PayloadAction<Pick<EditorState['issues'], 'total' | 'filterTotal'>>
    ) {
      state.issues = {
        ...state.issues,
        ...action.payload,
      };
    },
    updateFiltersIssueAction(
      state,
      action: PayloadAction<Pick<EditorState['issues'], 'filterLevel' | 'filterType'>>
    ) {
      state.issues = {
        ...state.issues,
        ...action.payload,
      };
    },
  },
});

export const {
  selectLayers,
  loadDataModelAction,
  updateTotalsIssueAction,
  updateFiltersIssueAction,
} = editorSlice.actions;

export type editorSliceActionsType = typeof editorSlice.actions;

export function loadDataModel(): ThunkAction<editorSliceActionsType['loadDataModelAction']> {
  return async (dispatch: Dispatch, getState) => {
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
        dispatch(setSuccessWithoutMessage());
        dispatch(loadDataModelAction(schema));
      } catch (e) {
        console.error(e);
        dispatch(setFailure(e as Error));
      }
    }
  };
}

export function updateTotalsIssue(
  infraID: number | undefined
): ThunkAction<editorSliceActionsType['updateTotalsIssueAction']> {
  return async (dispatch: Dispatch, getState) => {
    const { editor } = getState();
    dispatch(setLoading());
    try {
      let total = 0;
      let filterTotal = 0;
      if (infraID) {
        // Get total
        const totalResp = dispatch(
          osrdEditoastApi.endpoints.getInfraByIdErrors.initiate({
            id: infraID,
            level: 'all',
            errorType: undefined,
            pageSize: 1,
            page: 1,
          })
        );
        totalResp.unsubscribe();
        const totalResult = await totalResp;
        total = totalResult.data?.count || 0;

        // Get total for the active filters
        const filterResp = dispatch(
          osrdEditoastApi.endpoints.getInfraByIdErrors.initiate({
            id: infraID,
            level: editor.issues.filterLevel,
            errorType: editor.issues.filterType ?? undefined,
            pageSize: 1,
            page: 1,
          })
        );
        filterResp.unsubscribe();
        const filterResult = await filterResp;
        filterTotal = filterResult.data?.count || 0;
      }
      dispatch(updateTotalsIssueAction({ total, filterTotal }));
    } catch (e) {
      dispatch(setFailure(e as Error));
      throw e;
    } finally {
      dispatch(setSuccessWithoutMessage());
    }
  };
}

export function updateFiltersIssue(
  infraID: number | undefined,
  filters: Partial<Pick<EditorState['issues'], 'filterLevel' | 'filterType'>>
): ThunkAction<editorSliceActionsType['updateFiltersIssueAction']> {
  return async (dispatch: Dispatch, getState) => {
    const { editor } = getState() as { editor: EditorState };
    let level = isUndefined(filters.filterLevel) ? editor.issues.filterLevel : filters.filterLevel;
    let type = isUndefined(filters.filterType) ? editor.issues.filterType : filters.filterType;
    // Check compatibility btw level & type
    // if both are provided and there is an incompatibility, we keep the level
    if (!isNil(filters.filterLevel) && !isNil(filters.filterType)) {
      if (type && level !== 'all' && !infraErrorTypeList[level].has(type)) {
        type = null;
      }
    }
    // if only level is provided, we set the type to undefined
    if (!isNil(filters.filterLevel) && isNil(filters.filterType)) {
      type = null;
    }
    // if only type is provided, we check the level compatibility.
    // if it is not, we set it to "all"
    if (!isNil(filters.filterType) && isNil(filters.filterLevel)) {
      if (level !== 'all' && !infraErrorTypeList[level].has(filters.filterType)) {
        level = 'all';
      }
    }

    dispatch(updateFiltersIssueAction({ filterLevel: level, filterType: type }));
    dispatch(updateTotalsIssue(infraID));

    // dispatch the list of types matched by the filter to the map
    let derivedTypes = [];
    if (!isNil(type)) derivedTypes = [type];
    else derivedTypes = level === 'all' ? allInfraErrorTypes : [...infraErrorTypeList[level]];
    dispatch(
      updateIssuesSettings({
        types: derivedTypes,
      })
    );
  };
}

//
// Save modifications
//
const SAVE = 'editor/SAVE';
export interface ActionSave extends AnyAction {
  type: typeof SAVE;
  operations: {
    create?: Array<Feature>;
    update?: Array<Feature>;
    delete?: Array<Feature>;
  };
}
export function saveOperations(
  infraID: number | undefined,
  operations: Operation[],
  shouldLoad: boolean = true
): ThunkAction<ActionSave> {
  return async (dispatch: Dispatch) => {
    if (shouldLoad) {
      dispatch(setLoading());
    }
    try {
      if (isNil(infraID)) throw new Error('No infrastructure');
      const response = await dispatch(
        osrdEditoastApi.endpoints.postInfraById.initiate({
          id: infraID,
          body: operations,
        })
      );
      if ('data' in response) {
        // success message
        dispatch(
          setSuccess({
            title: i18next.t('common.success.save.title'),
            text: i18next.t('common.success.save.text'),
          })
        );
        return response.data;
      }
      throw new Error(JSON.stringify(response.error));
    } catch (e) {
      dispatch(setFailure(e as Error));
      throw e;
    } finally {
      dispatch(updateTotalsIssue(infraID));
    }
  };
}
export function save(
  infraID: number | undefined,
  operations: {
    create?: Array<EditorEntity>;
    update?: Array<{ source: EditorEntity; target: EditorEntity }>;
    delete?: Array<EditorEntity>;
  }
): ThunkAction<ActionSave> {
  const payload = [
    ...(operations.create || []).map((e) => entityToCreateOperation(e)),
    ...(operations.update || []).map((e) => entityToUpdateOperation(e.target, e.source)),
    ...(operations.delete || []).map((e) => entityToDeleteOperation(e)),
  ];
  return saveOperations(infraID, payload);
}

export type EditorActions =
  | editorSliceActionsType['loadDataModelAction']
  | editorSliceActionsType['selectLayers']
  | editorSliceActionsType['updateFiltersIssueAction']
  | editorSliceActionsType['updateTotalsIssueAction']
  | ActionSave;

export default editorSlice.reducer;
