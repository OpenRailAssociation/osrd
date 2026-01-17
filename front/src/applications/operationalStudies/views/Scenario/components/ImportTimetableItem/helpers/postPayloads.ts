import type { TFunction } from 'i18next';

import type { RoundTripsFromJson } from 'applications/operationalStudies/types';
import {
  osrdEditoastApi,
  type MacroNodeForm,
  type MacroNoteForm,
  type PacedTrain,
} from 'common/api/osrdEditoastApi';
import { setWarning, setSuccess, setFailure } from 'reducers/main';
import type { TimetableItem } from 'reducers/osrdconf/types';
import type { AppDispatch } from 'store';
import { extractEditoastIdFromPacedTrainId, formatEditoastIdToPacedTrainId } from 'utils/trainId';

import { generateRoundTripsPayload } from './generatePayloads';

// TODO: delete this helper and use createPacedTrains (possibly adding if (payloads.length) to it) when the pr createPacedTrain -> createPacedTrains is merged
export const postTimetableItems = async (
  timetableId: number,
  payloads: PacedTrain[],
  dispatch: AppDispatch
) => {
  let timetableItems: TimetableItem[] = [];
  if (payloads.length) {
    const rawTimetableItems = await dispatch(
      osrdEditoastApi.endpoints.postTimetableByIdPacedTrains.initiate({
        id: timetableId,
        body: payloads,
      })
    ).unwrap();

    timetableItems = rawTimetableItems.map((timetableItem) => ({
      ...timetableItem,
      id: formatEditoastIdToPacedTrainId(timetableItem.id),
    }));
  }
  return timetableItems;
};

const postRoundTrips = async (
  roundTrips: RoundTripsFromJson,
  formattedPacedTrains: TimetableItem[],
  dispatch: AppDispatch
): Promise<void> => {
  if (roundTrips.paced_trains.length > 0) {
    const payload = generateRoundTripsPayload(
      roundTrips.paced_trains,
      formattedPacedTrains,
      extractEditoastIdFromPacedTrainId
    );
    await dispatch(osrdEditoastApi.endpoints.postRoundTripsPacedTrains.initiate(payload)).unwrap();
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
  timetableId: number,
  scenarioId: number,
  trainPayloads: PacedTrain[],
  roundTrips: RoundTripsFromJson | undefined,
  macroNodes: MacroNodeForm[] | undefined,
  macroNotes: MacroNoteForm[] | undefined,
  dispatch: AppDispatch,
  t: TFunction<'operational-studies', 'importTrains'>,
  upsertTimetableItems: (items: TimetableItem[]) => void
): Promise<void> => {
  try {
    const timetableItems = await postTimetableItems(timetableId, trainPayloads, dispatch);

    if (roundTrips) {
      await postRoundTrips(roundTrips, timetableItems, dispatch);
    }

    if (macroNodes && macroNodes.length > 0) {
      await postMacroNodesIfNew(macroNodes, scenarioId, dispatch, t);
    }

    if (macroNotes && macroNotes.length > 0) {
      await dispatch(
        osrdEditoastApi.endpoints.postMacroNotes.initiate({
          macroNoteBatchForm: {
            macro_notes: macroNotes,
            scenario_id: scenarioId,
          },
        })
      ).unwrap();
    }

    upsertTimetableItems(timetableItems);

    dispatch(
      setSuccess({
        title: t('success'),
        text: t('status.successfulImport', {
          count: trainPayloads.length,
        }),
      })
    );
  } catch (error) {
    dispatch(
      setFailure({
        name: t('failure'),
        message: t('status.invalidTimetableItems', {
          count: trainPayloads.length,
        }),
      })
    );
    throw error;
  }
};
