import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import {
  checkChangeGroups,
  updatePacedTrainExceptionsList,
} from 'applications/operationalStudies/views/Scenario/components/ManageTimetableItem/helpers/buildPacedTrainException';
import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/views/Scenario/consts';
import type { PacedTrainException } from 'common/api/osrdEditoastApi';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import { findExceptionWithOccurrenceId } from 'modules/timetableItem/helpers/pacedTrain';
import {
  createExceptions,
  deleteExceptions,
  storePacedTrain,
  syncAndUpdatePacedTrain,
  syncOccurrenceException,
  updateExceptions,
} from 'modules/timetableItem/helpers/updateTimetableItemHelpers';
import { setSuccess } from 'reducers/main';
import { clearAddedExceptionsList } from 'reducers/osrdconf/operationalStudiesConf';
import {
  getName,
  getStartTime,
  getOperationalStudiesConf,
  getAddedExceptions,
} from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type { TimetableItem, TrainScheduleToEditData } from 'reducers/osrdconf/types';
import { updateSelectedTrain, updateTrainIdUsedForProjection } from 'reducers/simulationResults';
import { getTrainIdUsedForProjection } from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import { formatEditoastIdToPacedTrainId, isOccurrenceId } from 'utils/trainId';

import checkCurrentConfig from '../helpers/checkCurrentConfig';
import {
  formatOccurrenceException,
  formatPacedTrainPayload,
  formatPacedTrainWithDetailsToPacedTrainPayload,
} from '../helpers/formatTimetableItemPayload';

const useUpdateTimetableItem = (
  setIsWorking: (isWorking: boolean) => void,
  setDisplayTrainScheduleManagement: (type: string) => void,
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void,
  setTrainScheduleToEditData: (trainScheduleToEditData?: TrainScheduleToEditData) => void,
  trainScheduleToEditData?: TrainScheduleToEditData
) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'manageTimetableItem',
  });
  const dispatch = useAppDispatch();

  const { timetableId } = useScenarioContext();

  const confName = useSelector(getName);
  const simulationConf = useSelector(getOperationalStudiesConf);
  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);
  const startTime = useSelector(getStartTime);
  const addedExceptions = useSelector(getAddedExceptions);
  const { rollingStock } = useStoreDataForRollingStockSelector({
    rollingStockId: simulationConf.rollingStockID,
  });

  // Shared post-submit logic: dispatches success, updates selected train id, closes modal
  const handleUpdateSuccess = (trainScheduleId: number, editData: TrainScheduleToEditData) => {
    const editedTrainId =
      editData.occurrenceId ?? formatEditoastIdToPacedTrainId(editData.trainScheduleId);

    dispatch(
      setSuccess({
        title:
          simulationConf.editingItemType === 'uniqueTrain'
            ? t('pacedTrainUpdated')
            : t('uniqueTrainUpdated'),
        text: `${confName}: ${startTime.toLocaleString()}`,
      })
    );
    dispatch(updateSelectedTrain({ id: editedTrainId, by: 'timetable' }));

    // if the updated train was just transformed from pacedTrain to uniqueTrain
    // and one of the occurrences was used for the projection, update the projectedTrainId
    if (
      trainIdUsedForProjection &&
      isOccurrenceId(trainIdUsedForProjection) &&
      trainIdUsedForProjection.includes(`_${trainScheduleId}_`) &&
      !editData.originalPacedTrain.paced
    ) {
      dispatch(updateTrainIdUsedForProjection(formatEditoastIdToPacedTrainId(trainScheduleId)));
    }

    dispatch(clearAddedExceptionsList());
    setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.none);
    setTrainScheduleToEditData(undefined);
  };

  return async function submitConfUpdateTrainSchedules() {
    if (
      !trainScheduleToEditData ||
      !checkCurrentConfig(simulationConf, t, dispatch, rollingStock?.name)
    )
      return;

    setIsWorking(true);

    const { trainScheduleId, occurrenceId, originalPacedTrain } = trainScheduleToEditData;

    // ========== user is editing an occurrence ==========
    if (occurrenceId) {
      const { generatedException, occurrenceIndex } = formatOccurrenceException(
        simulationConf,
        rollingStock!.name,
        trainScheduleToEditData as TrainScheduleToEditData & {
          occurrenceId: NonNullable<TrainScheduleToEditData['occurrenceId']>;
        }
      );

      const existingException = findExceptionWithOccurrenceId(
        originalPacedTrain.paced?.exceptions ?? [],
        occurrenceId
      );

      const finalException = await syncOccurrenceException(
        dispatch,
        generatedException,
        existingException,
        occurrenceIndex,
        trainScheduleId,
        timetableId
      );

      const updatedExceptions = updatePacedTrainExceptionsList(
        originalPacedTrain.paced?.exceptions ?? [],
        finalException,
        occurrenceId
      );
      const formattedPacedTrain =
        formatPacedTrainWithDetailsToPacedTrainPayload(originalPacedTrain);

      upsertTimetableItems([
        {
          ...formattedPacedTrain,
          id: trainScheduleId,
          train_schedule_set_id: originalPacedTrain.train_schedule_set_id,
          paced: formattedPacedTrain.paced
            ? { ...formattedPacedTrain.paced, exceptions: updatedExceptions }
            : undefined,
        },
      ]);

      return handleUpdateSuccess(trainScheduleId, trainScheduleToEditData);
    }

    // ========== user is editing the whole paced train or transforming from an unique train ==========
    const trainSchedule = formatPacedTrainPayload(simulationConf, rollingStock!.name);

    const originalPacedExceptions = originalPacedTrain.paced?.exceptions ?? [];

    const newAddedExceptions: PacedTrainException[] = addedExceptions.map(
      ({ startTime: exStartTime }) => ({
        key: '', // TODO : remove this when the key will be removed from the model
        start_time: { value: exStartTime.toISOString() },
      })
    );

    // Converting a unique train into a paced train:
    // syncAndUpdatePacedTrain must be called first to make the train a paced train on the backend
    // before we can create exceptions on it.
    if (!originalPacedTrain.paced) {
      await syncAndUpdatePacedTrain(
        trainScheduleId,
        {
          ...trainSchedule,
          train_schedule_set_id: originalPacedTrain.train_schedule_set_id,
        },
        dispatch
      );
    }

    // Create new added exceptions (shared for both unique→paced conversion and paced train update)
    let createdExceptions: PacedTrainException[] = [];
    if (newAddedExceptions.length > 0) {
      const created = await createExceptions(
        dispatch,
        newAddedExceptions,
        trainScheduleId,
        timetableId
      );

      // TODO: remove this part when the back will be done inserting the new exception format in TrainSchedule
      createdExceptions = created.map(
        ({ change_groups, train_schedule_id: _, timetable_id: __, ...rest }) => ({
          ...change_groups,
          ...rest,
          // TODO_EXCEPTION: remove this when drop key in the model
          key: '',
        })
      );
    }

    // If we just converted a unique train to a paced train, upsert with created exceptions and return
    if (!originalPacedTrain.paced) {
      upsertTimetableItems([
        {
          ...trainSchedule,
          id: trainScheduleId,
          train_schedule_set_id: originalPacedTrain.train_schedule_set_id,
          ...(trainSchedule.paced && {
            paced: { ...trainSchedule.paced, exceptions: createdExceptions },
          }),
        },
      ]);

      return handleUpdateSuccess(trainScheduleId, trainScheduleToEditData);
    }

    // ========== user is converting a paced train to a unique train ==========
    if (!trainSchedule.paced) {
      // TODO_EXCEPTION: remove `!` when using TrainScheduleException type
      const exceptionsToDelete = (originalPacedTrain.paced?.exceptions ?? []).map((e) => e.id!);
      if (exceptionsToDelete.length > 0) {
        await deleteExceptions(dispatch, exceptionsToDelete);
      }
      await storePacedTrain(
        trainScheduleId,
        {
          ...trainSchedule,
          train_schedule_set_id: originalPacedTrain.train_schedule_set_id,
        },
        dispatch,
        upsertTimetableItems
      );

      return handleUpdateSuccess(trainScheduleId, trainScheduleToEditData);
    }

    // ========== user is editing an existing paced train ==========

    // Reconcile existing exceptions with the new paced train settings and newly added ones
    // Note: exceptions are reset by the backend when cadence/interval changes
    const intervalChanged =
      trainSchedule.paced.interval !== originalPacedTrain.paced.interval.toISOString() ||
      trainSchedule.paced.time_window !== originalPacedTrain.paced.timeWindow.toISOString();

    // Reconcile remaining exceptions with the new paced train settings and newly added ones
    const {
      exceptions: reconciledExceptions,
      modifiedExceptions: exceptionsToUpdate,
      exceptionsToDeleteIds,
    } = checkChangeGroups(
      trainSchedule,
      trainSchedule.paced,
      intervalChanged ? [] : originalPacedExceptions
    );

    if (exceptionsToDeleteIds.length > 0) {
      await deleteExceptions(dispatch, exceptionsToDeleteIds);
    }

    if (exceptionsToUpdate.length > 0) {
      await updateExceptions(dispatch, exceptionsToUpdate, trainScheduleId);
    }

    const finalExceptions = [...reconciledExceptions, ...createdExceptions];

    // Store the paced train with the final exceptions list
    await storePacedTrain(
      trainScheduleId,
      {
        ...trainSchedule,
        train_schedule_set_id: originalPacedTrain.train_schedule_set_id,
        ...(trainSchedule.paced && {
          paced: { ...trainSchedule.paced, exceptions: finalExceptions },
        }),
      },
      dispatch,
      upsertTimetableItems
    );

    return handleUpdateSuccess(trainScheduleId, trainScheduleToEditData);
  };
};

export default useUpdateTimetableItem;
