import { isNil, omit } from 'lodash';

import {
  osrdEditoastApi,
  type MacroNodeResponse,
  type PathItemLocation,
  type SearchResultItemOperationalPoint,
} from 'common/api/osrdEditoastApi';
import type { AppDispatch } from 'store';
import type { Duration } from 'utils/duration';

import type MacroEditorState from './MacroEditorState';
import type { NodeIndexed } from './MacroEditorState';

export const findOpFromPathItem = (
  pathItem: PathItemLocation,
  searchResults: SearchResultItemOperationalPoint[]
) => {
  // When a path item doesn't specify a secondary code, mimick what editoast
  // does: pick 'BV', '00' or an OP without a ch.
  let chs: (string | null)[] = [];
  if ('uic' in pathItem || 'trigram' in pathItem) {
    if (pathItem.secondary_code) {
      chs = [pathItem.secondary_code];
    } else {
      chs = ['BV', '00', null];
    }
  }

  return searchResults.find((searchResult) => {
    if ('uic' in pathItem) {
      return searchResult.uic === pathItem.uic && chs.includes(searchResult.ch);
    }
    if ('trigram' in pathItem) {
      return searchResult.trigram === pathItem.trigram && chs.includes(searchResult.ch);
    }
    if ('operational_point' in pathItem) {
      return searchResult.obj_id === pathItem.operational_point;
    }
    return false;
  });
};

export const addDurationToDate = (date: Date, duration: Duration) =>
  new Date(date.getTime() + duration.ms);

export const createMacroNode = async (
  state: MacroEditorState,
  dispatch: AppDispatch,
  node: Omit<MacroNodeResponse, 'id'>,
  ngeNodeId: number
) => {
  try {
    const createPromise = dispatch(
      osrdEditoastApi.endpoints.postProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodes.initiate(
        {
          projectId: state.scenario.project.id,
          studyId: state.scenario.study_id,
          scenarioId: state.scenario.id,
          macroNodeForm: node,
        }
      )
    );
    const newNode = await createPromise.unwrap();
    state.indexNodeByKey(newNode.path_item_key, {
      ...omit(newNode, ['id']),
      ngeId: ngeNodeId,
      dbId: newNode.id,
    });
  } catch (e) {
    console.error(e);
  }
};
export const updateMacroNode = async (
  state: MacroEditorState,
  dispatch: AppDispatch,
  node: NodeIndexed
) => {
  try {
    const indexedNode = state.getNodeByNgeId(node.ngeId);
    if (!indexedNode) throw new Error(`Node ${node.ngeId} not found`);
    if (!indexedNode.dbId) throw new Error(`Node ${node.ngeId} is not saved in the DB`);

    await dispatch(
      osrdEditoastApi.endpoints.putProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodesNodeId.initiate(
        {
          projectId: state.scenario.project.id,
          studyId: state.scenario.study_id,
          scenarioId: state.scenario.id,
          nodeId: indexedNode.dbId,
          macroNodeForm: node,
        }
      )
    );
    state.indexNodeByKey(indexedNode.path_item_key, node);
  } catch (e) {
    console.error(e);
  }
};

export const deleteMacroNodeByDbId = async (
  state: MacroEditorState,
  dispatch: AppDispatch,
  dbId: number
) => {
  try {
    await dispatch(
      osrdEditoastApi.endpoints.deleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodesNodeId.initiate(
        {
          projectId: state.scenario.project.id,
          studyId: state.scenario.study_id,
          scenarioId: state.scenario.id,
          nodeId: dbId,
        }
      )
    );
  } catch (e) {
    console.error(e);
  }
};

export const deleteMacroNodeByNgeId = async (
  state: MacroEditorState,
  dispatch: AppDispatch,
  ngeId: number
) => {
  try {
    const indexedNode = state.getNodeByNgeId(ngeId);
    if (indexedNode?.dbId) await deleteMacroNodeByDbId(state, dispatch, indexedNode.dbId);
    state.deleteNodeByNgeId(ngeId);
  } catch (e) {
    console.error(e);
  }
};

/**
 * Get nodes of the scenario that are saved in the DB.
 */
export const getSavedMacroNodes = async (
  state: MacroEditorState,
  dispatch: AppDispatch
): Promise<MacroNodeResponse[]> => {
  const pageSize = 100;
  let page = 1;
  let reachEnd = false;
  const result: MacroNodeResponse[] = [];
  while (!reachEnd) {
    const promise = dispatch(
      osrdEditoastApi.endpoints.getProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodes.initiate(
        {
          projectId: state.scenario.project.id,
          studyId: state.scenario.study_id,
          scenarioId: state.scenario.id,
          pageSize,
          page,
        },
        { forceRefetch: true, subscribe: false }
      )
    );
    // need to unsubscribe on get call to avoid cache issue
    const { data } = await promise;
    if (data) result.push(...data.results);
    reachEnd = isNil(data?.next);
    page += 1;
  }
  return result;
};
