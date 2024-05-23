import i18next from 'i18next';
import type { JSONSchema7, JSONSchema7Definition } from 'json-schema';
import { omit, clone, isNil, isUndefined } from 'lodash';

import {
  INFRA_ERRORS,
  INFRA_ERRORS_BY_LEVEL,
} from 'applications/editor/components/InfraErrors/consts';
import {
  entityToCreateOperation,
  entityToUpdateOperation,
  entityToDeleteOperation,
} from 'applications/editor/data/utils';
import type { EditorEntity, EditorSchema } from 'applications/editor/typesEditorEntity';
import type { Operation } from 'common/api/osrdEditoastApi';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { setLoading, setSuccess, setFailure, setSuccessWithoutMessage } from 'reducers/main';
import { updateIssuesSettings } from 'reducers/map';
import infra_schema from 'reducers/osrdconf/infra_schema.json';
import type { AppDispatch, GetState } from 'store';
import { castErrorToFailure } from 'utils/error';

import { type EditorState, editorSliceActions } from '.';

const { loadDataModelAction, updateTotalsIssueAction, updateFiltersIssueAction } =
  editorSliceActions;

export function loadDataModel() {
  return async (dispatch: AppDispatch, getState: GetState) => {
    // check if we need to load the model
    if (!Object.keys(getState().editor.editorSchema).length) {
      dispatch(setLoading());
      try {
        const schemaResponse = infra_schema as JSONSchema7;
        // parse the schema
        const fieldToOmit = ['id', 'geo'];
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
        dispatch(setFailure(castErrorToFailure(e)));
      }
    }
  };
}

export function updateTotalsIssue(infraID: number | undefined) {
  return async (dispatch: AppDispatch, getState: GetState) => {
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
      dispatch(setFailure(castErrorToFailure(e)));
    } finally {
      dispatch(setSuccessWithoutMessage());
    }
  };
}

export function updateFiltersIssue(
  infraID: number | undefined,
  filters: Partial<Pick<EditorState['issues'], 'filterLevel' | 'filterType'>>
) {
  return async (dispatch: AppDispatch, getState: GetState) => {
    const { editor } = getState() as { editor: EditorState };
    let level = isUndefined(filters.filterLevel) ? editor.issues.filterLevel : filters.filterLevel;
    let type = isUndefined(filters.filterType) ? editor.issues.filterType : filters.filterType;
    // Check compatibility btw level & type
    // if both are provided and there is an incompatibility, we keep the level
    if (!isNil(filters.filterLevel) && !isNil(filters.filterType)) {
      if (type && level !== 'all' && !INFRA_ERRORS_BY_LEVEL[level].has(type)) {
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
      if (level !== 'all' && !INFRA_ERRORS_BY_LEVEL[level].has(filters.filterType)) {
        level = 'all';
      }
    }

    dispatch(updateFiltersIssueAction({ filterLevel: level, filterType: type }));
    dispatch(updateTotalsIssue(infraID));

    // dispatch the list of types matched by the filter to the map
    let derivedTypes = [];
    if (!isNil(type)) derivedTypes = [type];
    else derivedTypes = level === 'all' ? INFRA_ERRORS : [...INFRA_ERRORS_BY_LEVEL[level]];
    dispatch(
      updateIssuesSettings({
        types: derivedTypes,
      })
    );
  };
}

export function saveOperations(
  infraID: number | undefined,
  operations: Operation[],
  shouldLoad: boolean = true
) {
  return async (dispatch: AppDispatch) => {
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
      throw response.error;
    } catch (e) {
      dispatch(
        setFailure(
          castErrorToFailure(e, {
            name: i18next.t('common.failure.save.title'),
            message: i18next.t('common.failure.save.text'),
          })
        )
      );
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
) {
  const payload = [
    ...(operations.create || []).map((e) => entityToCreateOperation(e)),
    ...(operations.update || []).map((e) => entityToUpdateOperation(e.target, e.source)),
    ...(operations.delete || []).map((e) => entityToDeleteOperation(e)),
  ];
  return saveOperations(infraID, payload);
}
