import type { TFunction } from 'i18next';
import { omit } from 'lodash';

import {
  osrdEditoastApi,
  type MacroNodeResponse,
  type SearchResultItemOperationalPoint,
  type SubCategory,
  type TrainCategory,
} from 'common/api/osrdEditoastApi';
import isMainCategory from 'modules/rollingStock/helpers/category';
import { isPacedTrain } from 'modules/timetableItem/helpers/pacedTrain';
import type { TimetableItem } from 'reducers/osrdconf/types';
import type { AppDispatch } from 'store';
import { Duration } from 'utils/duration';

import type { TrainrunCategory, TrainrunFrequency, TrainrunTimeCategory } from '../NGE/types';
import {
  CUSTOM_TRAINRUN_TIME_CATEGORY,
  DEFAULT_PACED_TRAIN_FREQUENCY_IDS,
  DEFAULT_TRAINRUN_TIME_CATEGORY,
  UNIQUE_TRAIN_TIME_CATEGORY,
  UNIQUE_TRAIN_FREQUENCY_ID,
  DEFAULT_TRAINRUN_FREQUENCIES,
  NETZGRAFIK_COLOR_PALETTE,
  CATEGORY_COLOR_VARIANTS,
  OSRD_TRAINRUN_MAIN_CATEGORY_CODE_MAPPING,
  TRAIN_MAIN_CATEGORY_TO_NGE,
} from './consts';
import type MacroEditorState from './MacroEditorState';
import type { NodeIndexed } from './MacroEditorState';

export const createMacroNode = async (
  state: MacroEditorState,
  dispatch: AppDispatch,
  node: Omit<MacroNodeResponse, 'id'>,
  ngeNodeId: number
) => {
  const createPromise = dispatch(
    osrdEditoastApi.endpoints.postMacroNodes.initiate({
      macroNodeBatchForm: { macro_nodes: [node], scenario_id: state.scenarioId },
    })
  );
  const result = await createPromise.unwrap();
  const newNode = result.macro_nodes[0];
  state.indexNodeByKey(newNode.path_item_key, {
    ...omit(newNode, ['id']),
    ngeId: ngeNodeId,
    dbId: newNode.id,
  });
};

export const updateMacroNode = async (
  state: MacroEditorState,
  dispatch: AppDispatch,
  node: NodeIndexed
) => {
  const indexedNode = state.getNodeByNgeId(node.ngeId);
  if (!indexedNode) throw new Error(`Node ${node.ngeId} not found`);
  if (!indexedNode.dbId) throw new Error(`Node ${node.ngeId} is not saved in the DB`);

  await dispatch(
    osrdEditoastApi.endpoints.putMacroNodesByNodeId.initiate({
      nodeId: indexedNode.dbId,
      macroNodeForm: node,
    })
  ).unwrap();
  state.indexNodeByKey(indexedNode.path_item_key, node);
};

export const deleteMacroNodeByDbId = async (dispatch: AppDispatch, dbId: number) => {
  await dispatch(
    osrdEditoastApi.endpoints.deleteMacroNodesByNodeId.initiate({
      nodeId: dbId,
    })
  ).unwrap();
};

export const deleteMacroNodeByNgeId = async (
  state: MacroEditorState,
  dispatch: AppDispatch,
  ngeId: number
) => {
  const indexedNode = state.getNodeByNgeId(ngeId);
  if (indexedNode?.dbId) await deleteMacroNodeByDbId(dispatch, indexedNode.dbId);
  state.deleteNodeByNgeId(ngeId);
};

export const storeRoundTrip = async (
  dispatch: AppDispatch,
  forwardId: number,
  returnId?: number
) => {
  let roundTrips;
  if (returnId) {
    roundTrips = {
      round_trips: [[forwardId, returnId]],
    };
  } else {
    roundTrips = {
      one_ways: [forwardId],
    };
  }
  await dispatch(
    osrdEditoastApi.endpoints.postRoundTripsTrainSchedules.initiate({
      roundTrips,
    })
  ).unwrap();
};

/**
 * Check if every new nodes (from import) are already in the DB (by path_item_key).
 * If not we persist them and update the state with their dbIds.
 */
export const storeTrainPathNodes = async (state: MacroEditorState, dispatch: AppDispatch) => {
  const allNodes = state.nodes.filter((n) => n && !n.dbId);

  if (!allNodes.length) return;

  const payload = allNodes.map((n) => omit(n, ['ngeId', 'geocoord']));

  const result = await dispatch(
    osrdEditoastApi.endpoints.postMacroNodes.initiate({
      macroNodeBatchForm: { macro_nodes: payload, scenario_id: state.scenarioId },
    })
  ).unwrap();

  result.macro_nodes.forEach((createdNode) => {
    state.updateNodeDataByKey(createdNode.path_item_key, {
      dbId: createdNode.id,
    });
  });
};

/**
 * Return the default TrainrunFrequencies with their translated names.
 */
export const getDefaultTrainrunFrequencies = (
  t: TFunction<'operational-studies'>
): TrainrunFrequency[] =>
  DEFAULT_TRAINRUN_FREQUENCIES.map((freq) => ({
    ...freq,
    name:
      freq.id === UNIQUE_TRAIN_FREQUENCY_ID
        ? t('main.macroEditor.uniqueTrain')
        : t('main.macroEditor.intervalXmin', { minutes: freq.frequency }),
  }));

/**
 * TrainrunTimeCategory is not used as a feature, but for its LinePatternRef style.
 */
export const getTrainrunTimeCategoryFromFrequency = (
  trainrunFrequency: TrainrunFrequency
): TrainrunTimeCategory => {
  if (trainrunFrequency.id === UNIQUE_TRAIN_FREQUENCY_ID) {
    return UNIQUE_TRAIN_TIME_CATEGORY;
  }
  if (!DEFAULT_PACED_TRAIN_FREQUENCY_IDS.includes(trainrunFrequency.id)) {
    return CUSTOM_TRAINRUN_TIME_CATEGORY;
  }
  return DEFAULT_TRAINRUN_TIME_CATEGORY;
};

/**
 * Get a Frequency by its id.
 */
export const getFrequencyFromFrequencyId = (
  trainrunFrequencies: TrainrunFrequency[],
  frequencyId: number
): TrainrunFrequency => {
  const frequency = trainrunFrequencies.find((f) => f.id === frequencyId);
  if (!frequency) {
    throw new Error(`Frequency with ID ${frequencyId} not found.`);
  }
  return frequency;
};

/**
 * Get the associated TrainrunFrequency of a TimetableItem.
 */
export const getTrainrunFrequencyFromTimetableItem = (
  timetableItem: TimetableItem,
  state: MacroEditorState
): TrainrunFrequency => {
  if (!isPacedTrain(timetableItem)) {
    return getFrequencyFromFrequencyId(state.trainrunFrequencies, UNIQUE_TRAIN_FREQUENCY_ID);
  }
  const intervalInMinutes = Duration.parse(timetableItem.paced.interval).total('minute');
  const trainrunFrequency = state.trainrunFrequencies.find(
    (f) => f.frequency === intervalInMinutes
  );
  if (!trainrunFrequency) {
    throw new Error(`Frequency with interval '${intervalInMinutes}' not found.`);
  }
  return trainrunFrequency;
};

export const getNetzgrafikColors = (subCategories: SubCategory[]) => {
  const mainColors = Object.entries(NETZGRAFIK_COLOR_PALETTE).map(
    ([colorRef, baseColor], index) => ({
      id: index,
      colorRef,
      color: CATEGORY_COLOR_VARIANTS[`${baseColor}50`],
      colorFocus: CATEGORY_COLOR_VARIANTS[`${baseColor}70`],
      colorMuted: CATEGORY_COLOR_VARIANTS[`${baseColor}10`],
      colorRelated: CATEGORY_COLOR_VARIANTS[`${baseColor}50`],
      colorDarkMode: CATEGORY_COLOR_VARIANTS[`${baseColor}50`],
      colorDarkModeFocus: CATEGORY_COLOR_VARIANTS[`${baseColor}70`],
      colorDarkModeMuted: CATEGORY_COLOR_VARIANTS[`${baseColor}10`],
      colorDarkModeRelated: CATEGORY_COLOR_VARIANTS[`${baseColor}50`],
    })
  );

  const subColors = subCategories.map((cat, index) => ({
    id: mainColors.length + index,
    colorRef: 'sub_' + cat.code,
    color: cat.color,
    colorFocus: cat.hovered_color,
    colorMuted: cat.background_color,
    colorRelated: cat.color,
    colorDarkMode: cat.color,
    colorDarkModeFocus: cat.hovered_color,
    colorDarkModeMuted: cat.background_color,
    colorDarkModeRelated: cat.color,
  }));

  return [...mainColors, ...subColors];
};

export const getTrainCategoryFromTrainrunCategoryId = (
  trainrunCategories: TrainrunCategory[],
  id: number
): TrainCategory | null => {
  const category = trainrunCategories.find((cat) => cat.id === id);
  if (!category) throw new Error(`Trainrun category with ID ${id} not found.`);
  if (category.colorRef.startsWith('sub_')) {
    return {
      sub_category_code: category.colorRef.replace('sub_', ''),
    };
  }

  const mainCat = TRAIN_MAIN_CATEGORY_TO_NGE.find((cat) => cat.colorRef === category.colorRef);

  if (!mainCat || mainCat.trainCategory === 'NO_CATEGORY') {
    return null;
  }
  return { main_category: mainCat.trainCategory };
};

// If the categoryKey is null or undefined, we return the ID for 'NO_CATEGORY'
export const getTrainrunCategoryId = (
  trainrunCategories: TrainrunCategory[],
  trainCategory?: TrainCategory | null
): number => {
  if (trainCategory && isMainCategory(trainCategory)) {
    const mainKey = trainCategory.main_category;
    return OSRD_TRAINRUN_MAIN_CATEGORY_CODE_MAPPING.get(mainKey)!.id;
  } else if (!trainCategory) {
    return OSRD_TRAINRUN_MAIN_CATEGORY_CODE_MAPPING.get('NO_CATEGORY')!.id;
  }

  const subKey = 'sub_' + trainCategory.sub_category_code;
  return trainrunCategories.find((cat) => cat.colorRef === subKey)!.id;
};

export const fetchStationSecondaryCode = async (
  trigram: string,
  infraId: number,
  dispatch: AppDispatch
) => {
  const searchPayload = {
    object: 'operationalpoint',
    query: ['and', ['=', ['infra_id'], infraId], ['=', ['trigram'], trigram]],
  };
  const searchResults = (await dispatch(
    osrdEditoastApi.endpoints.postSearch.initiate({
      searchPayload,
    })
  ).unwrap()) as SearchResultItemOperationalPoint[];

  const stationOp = searchResults.find((op) => op.ch === 'BV' || op.ch === '00');
  return stationOp?.ch;
};
