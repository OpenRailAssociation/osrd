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
import { notifyLoadingStart, notifySuccess, notifyFailure, notifyLoadingEnd } from 'reducers/main';
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
      dispatch(notifyLoadingStart());
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
        dispatch(notifyLoadingEnd());
        dispatch(loadDataModelAction(schema));
      } catch (e) {
        dispatch(notifyFailure(castErrorToFailure(e)));
      }
    }
  };
}

export function updateTotalsIssue(infraID: number | undefined) {
  return async (dispatch: AppDispatch, getState: GetState) => {
    const { editor } = getState();
    dispatch(notifyLoadingStart());
    try {
      let total = 0;
      let filterTotal = 0;
      if (infraID) {
        // Get total
        const totalResp = await dispatch(
          osrdEditoastApi.endpoints.getInfraByInfraIdErrors.initiate(
            {
              infraId: infraID,
              level: 'all',
              errorType: undefined,
              pageSize: 1,
              page: 1,
            },
            { subscribe: false, forceRefetch: true }
          )
        );
        total = totalResp.data?.count || 0;
        filterTotal = total;

        // Get total for the active filters (if needed)
        if (editor.issues.filterLevel !== 'all' || !isNil(editor.issues.filterType)) {
          const filterResp = await dispatch(
            osrdEditoastApi.endpoints.getInfraByInfraIdErrors.initiate(
              {
                infraId: infraID,
                level: editor.issues.filterLevel,
                errorType: editor.issues.filterType ?? undefined,
                pageSize: 1,
                page: 1,
              },
              { subscribe: false, forceRefetch: true }
            )
          );
          filterTotal = filterResp.data?.count || 0;
        }
      }
      dispatch(updateTotalsIssueAction({ total, filterTotal }));
    } catch (e) {
      dispatch(notifyFailure(castErrorToFailure(e)));
    } finally {
      dispatch(notifyLoadingEnd());
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
  infraId: number | undefined,
  operations: Operation[],
  shouldLoad: boolean = true
) {
  return async (dispatch: AppDispatch) => {
    if (shouldLoad) {
      dispatch(notifyLoadingStart());
    }
    try {
      if (isNil(infraId)) throw new Error('No infrastructure');
      const response = await dispatch(
        osrdEditoastApi.endpoints.postInfraByInfraId.initiate({
          infraId,
          body: operations,
        })
      );
      if (response.data) {
        // success message
        dispatch(
          notifySuccess({
            title: i18next.t('common.success.save.title'),
            text: i18next.t('common.success.save.text'),
          })
        );
        return response.data;
      }
      throw response.error;
    } catch (e) {
      dispatch(
        notifyFailure(
          castErrorToFailure(e, {
            name: i18next.t('common.failure.save.title'),
            message: i18next.t('common.failure.save.text'),
          })
        )
      );
      throw e;
    } finally {
      dispatch(updateTotalsIssue(infraId));
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

export function saveSplitTrackSection(
  infraId: number | undefined,
  trackId: string,
  offset: number
) {
  return async (dispatch: AppDispatch): Promise<string[]> => {
    dispatch(notifyLoadingStart());
    try {
      if (isNil(infraId)) throw new Error('No infrastructure');
      const response = await dispatch(
        osrdEditoastApi.endpoints.postInfraByInfraIdSplitTrackSection.initiate({
          infraId,
          trackOffset: { track: trackId, offset },
        })
      );
      if (response.data) {
        // success message
        dispatch(
          notifySuccess({
            title: i18next.t('common.success.save.title'),
            text: i18next.t('common.success.save.text'),
          })
        );
        return response.data;
      }
      throw response.error;
    } catch (e) {
      dispatch(
        notifyFailure(
          castErrorToFailure(e, {
            name: i18next.t('common.failure.save.title'),
            message: i18next.t('common.failure.save.text'),
          })
        )
      );
      throw e;
    } finally {
      dispatch(updateTotalsIssue(infraId));
    }
  };
}
