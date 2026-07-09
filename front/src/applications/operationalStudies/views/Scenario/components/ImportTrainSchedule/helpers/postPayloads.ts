import type { TFunction } from 'i18next';
import { chunk } from 'lodash';

import type {
  RoundTripsFromJson,
  TimetableJsonPayload,
} from 'applications/operationalStudies/types';
import {
  osrdEditoastApi,
  type MacroNodeForm,
  type PacedTrainException,
  type SubCategory,
  type TrainSchedule,
  type TrainScheduleResponse,
} from 'common/api/osrdEditoastApi';
import {
  createTrainSchedules,
  createExceptions,
} from 'modules/trainSchedule/helpers/updateTrainScheduleHelpers';
import { setWarning, setFailure } from 'reducers/main';
import type { AppDispatch } from 'store';

import { generateRoundTripsPayload, generateTrainPayloads } from './generatePayloads';

const postRoundTrips = async (
  roundTrips: RoundTripsFromJson,
  formattedTrainSchedules: TrainScheduleResponse[],
  dispatch: AppDispatch
): Promise<void> => {
  if (roundTrips.length > 0) {
    const payload = generateRoundTripsPayload(
      roundTrips,
      formattedTrainSchedules.map(({ id }) => ({ id }))
    );
    await dispatch(osrdEditoastApi.endpoints.postRoundTrips.initiate(payload)).unwrap();
  }
};

/**
 * Post macro nodes if their trigrams are not already present in the database.
 * Displays a warning to the user if any nodes do not get posted.
 */
const postMacroNodesIfNew = async (
  nodes: MacroNodeForm[],
  scenarioId: number,
  dispatch: AppDispatch,
  t: TFunction<'operational-studies', 'importTrains'>
): Promise<void> => {
  const storedNodes = await dispatch(
    osrdEditoastApi.endpoints.getAllMacroNodes.initiate({ scenarioId }, { subscribe: false })
  ).unwrap();
  const storedNodesKeys = new Set(storedNodes.map((node) => node.path_item_key));
  const newMacroNodes = nodes.filter((node) => !storedNodesKeys.has(node.path_item_key));
  if (newMacroNodes.length > 0) {
    await dispatch(
      osrdEditoastApi.endpoints.postMacroNodes.initiate({
        macroNodeBatchForm: { macro_nodes: newMacroNodes, scenario_id: scenarioId },
      })
    ).unwrap();
  }
  const ignoredNodesCount = nodes.length - newMacroNodes.length;
  if (ignoredNodesCount)
    dispatch(
      setWarning({
        title: t('warningMessages.warning'),
        text: t('warningMessages.alreadyPresentNode', {
          count: ignoredNodesCount,
        }),
      })
    );
};

export const postFullImportPayload = async (
  trainScheduleSetId: number,
  timetableId: number,
  scenarioId: number,
  timetableJsonPayload: TimetableJsonPayload,
  subCategories: SubCategory[],
  dispatch: AppDispatch,
  t: TFunction<'operational-studies', 'importTrains'>,
  upsertTrainSchedules: (trainSchedules: TrainScheduleResponse[]) => void
): Promise<TrainScheduleResponse[]> => {
  try {
    const { round_trips, macro_nodes, macro_notes } = timetableJsonPayload;
    const {
      trainSchedules,
      exceptions,
    }: { trainSchedules: TrainSchedule[]; exceptions: PacedTrainException[][] } =
      generateTrainPayloads(timetableJsonPayload.train_schedules, subCategories);

    const newtrainschedules: TrainScheduleResponse[] = [];

    const BATCH_SIZE = 1000;
    const trainChunks = chunk(trainSchedules, BATCH_SIZE);
    for (const trainChunk of trainChunks) {
      const createdTrains = await createTrainSchedules(dispatch, trainScheduleSetId, trainChunk);
      newtrainschedules.push(...createdTrains);
    }

    // TODO: when batch POST is available, replace this loop with a single batch call
    const exceptionsWithTrainIds = exceptions
      .map((trainExceptions, i) => ({ trainExceptions, pacedTrainId: newtrainschedules[i].id }))
      .filter(({ trainExceptions }) => trainExceptions.length > 0);

    for (const { trainExceptions, pacedTrainId } of exceptionsWithTrainIds) {
      const created = await createExceptions(dispatch, trainExceptions, pacedTrainId, timetableId);

      // TODO: remove this part when the back will be done inserting the new exception format in TrainSchedule
      const createdExceptions = created.map(
        ({ change_groups, train_schedule_id: _, timetable_id: __, ...rest }) => ({
          ...change_groups,
          ...rest,
          // TODO_EXCEPTION: remove this when drop key in the model
          key: '',
        })
      );

      // Update the trainSchedule with its exceptions
      const trainIndex = newtrainschedules.findIndex(
        (trainSchedule) => trainSchedule.id === pacedTrainId
      );
      if (trainIndex === -1) continue;
      const currentTrain = newtrainschedules[trainIndex];
      if (currentTrain.paced) {
        newtrainschedules[trainIndex] = {
          ...currentTrain,
          paced: {
            ...currentTrain.paced,
            exceptions: createdExceptions,
          },
        };
      }
    }

    if (round_trips) {
      await postRoundTrips(round_trips, newtrainschedules, dispatch);
    }

    if (macro_nodes && macro_nodes.length > 0) {
      await postMacroNodesIfNew(macro_nodes, scenarioId, dispatch, t);
    }

    if (macro_notes && macro_notes.length > 0) {
      await dispatch(
        osrdEditoastApi.endpoints.postMacroNotes.initiate({
          macroNoteBatchForm: {
            macro_notes,
            scenario_id: scenarioId,
          },
        })
      ).unwrap();
    }

    upsertTrainSchedules(newtrainschedules);

    return newtrainschedules;
  } catch (error) {
    dispatch(
      setFailure({
        name: t('failure'),
        message: t('status.invalidTrainSchedules', {
          count: timetableJsonPayload.train_schedules.length,
        }),
      })
    );
    throw error;
  }
};
