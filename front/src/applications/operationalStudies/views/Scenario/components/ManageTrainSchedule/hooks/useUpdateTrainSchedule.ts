import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import {
  checkChangeGroups,
  updatePacedTrainExceptionsList,
} from 'applications/operationalStudies/views/Scenario/components/ManageTrainSchedule/helpers/buildPacedTrainException';
import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/views/Scenario/consts';
import type {
  PacedTrainException,
  TrainSchedule,
  TrainScheduleResponse,
} from 'common/api/osrdEditoastApi';
import { findExceptionWithOccurrenceId } from 'modules/trainSchedule/helpers/pacedTrain';
import {
  createExceptions,
  deleteExceptions,
  storePacedTrain,
  syncAndUpdatePacedTrain,
  syncOccurrenceException,
  updateExceptions,
} from 'modules/trainSchedule/helpers/updateTrainScheduleHelpers';
import type { PacedTrainWithDetails } from 'modules/trainSchedule/types';
import { setFailure, setSuccess } from 'reducers/main';
import { clearAddedExceptionsList } from 'reducers/osrdconf/operationalStudiesConf';
import {
  getName,
  getStartTime,
  getOperationalStudiesConf,
  getAddedExceptions,
} from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type { OccurrenceId, TrainScheduleToEditData } from 'reducers/osrdconf/types';
import {
  updateAlreadySelectedTrainId,
  updateTrainIdUsedForProjection,
} from 'reducers/simulationResults';
import { getTrainIdUsedForProjection } from 'reducers/simulationResults/selectors';
import { useAppDispatch, type AppDispatch } from 'store';
import { formatEditoastIdToPacedTrainId, isOccurrenceId } from 'utils/trainId';

import {
  formatOccurrenceException,
  formatPacedTrainWithDetailsToTrainSchedule,
  formatTrainSchedulePayload,
} from '../helpers/formatTrainSchedulePayload';
import {
  validateTrainSchedule,
  type TrainScheduleConfErrorCode,
} from '../helpers/validateTrainSchedule';

type UpdateTrainScheduleParams = {
  timetableId: number;
  trainScheduleId: number;
  originalPacedTrain: PacedTrainWithDetails;
  updatedTrainSchedule: TrainSchedule;
  occurrenceId?: OccurrenceId;
  addedExceptions: { startTime: Date }[];
  upsertTrainSchedules: (trainSchedules: TrainScheduleResponse[]) => void;
  dispatch: AppDispatch;
};

type UpdateTrainScheduleResult =
  | {
      success: true;
      trainScheduleId: number;
      originalPacedTrain: PacedTrainWithDetails;
      occurrenceId?: OccurrenceId;
    }
  | { success: false; errorCodes: TrainScheduleConfErrorCode[] };

export async function updateTrainSchedule({
  timetableId,
  trainScheduleId,
  originalPacedTrain,
  updatedTrainSchedule,
  occurrenceId,
  addedExceptions,
  upsertTrainSchedules,
  dispatch,
}: UpdateTrainScheduleParams): Promise<UpdateTrainScheduleResult> {
  const validationErrors = validateTrainSchedule(updatedTrainSchedule);
  if (validationErrors.length) {
    return { success: false, errorCodes: validationErrors };
  }

  // ========== user is editing an occurrence ==========
  if (occurrenceId) {
    const { generatedException, occurrenceIndex } = formatOccurrenceException(
      updatedTrainSchedule,
      originalPacedTrain,
      occurrenceId
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
    const formattedPacedTrain = formatPacedTrainWithDetailsToTrainSchedule(originalPacedTrain);

    upsertTrainSchedules([
      {
        ...formattedPacedTrain,
        id: trainScheduleId,
        train_schedule_set_id: originalPacedTrain.train_schedule_set_id,
        paced: formattedPacedTrain.paced
          ? { ...formattedPacedTrain.paced, exceptions: updatedExceptions }
          : undefined,
      },
    ]);

    return { success: true, trainScheduleId, originalPacedTrain, occurrenceId };
  }

  // ========== user is editing the whole paced train or transforming from an unique train ==========
  const originalPacedExceptions = originalPacedTrain.paced?.exceptions ?? [];

  const newAddedExceptions: PacedTrainException[] = addedExceptions.map(
    ({ startTime: exStartTime }) => ({
      key: '', // TODO : remove this when the key will be removed from the model
      start_time: { value: exStartTime.getTime() },
    })
  );

  // Converting a unique train into a paced train:
  // syncAndUpdatePacedTrain must be called first to make the train a paced train on the backend
  // before we can create exceptions on it.
  if (!originalPacedTrain.paced) {
    await syncAndUpdatePacedTrain(
      trainScheduleId,
      {
        ...updatedTrainSchedule,
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
    upsertTrainSchedules([
      {
        ...updatedTrainSchedule,
        id: trainScheduleId,
        train_schedule_set_id: originalPacedTrain.train_schedule_set_id,
        ...(updatedTrainSchedule.paced && {
          paced: { ...updatedTrainSchedule.paced, exceptions: createdExceptions },
        }),
      },
    ]);

    return { success: true, trainScheduleId, originalPacedTrain, occurrenceId };
  }

  // ========== user is converting a paced train to a unique train ==========
  if (!updatedTrainSchedule.paced) {
    // TODO_EXCEPTION: remove `!` when using TrainScheduleException type
    const exceptionsToDelete = (originalPacedTrain.paced?.exceptions ?? []).map((e) => e.id!);
    if (exceptionsToDelete.length > 0) {
      await deleteExceptions(dispatch, exceptionsToDelete);
    }
    await storePacedTrain(
      trainScheduleId,
      {
        ...updatedTrainSchedule,
        train_schedule_set_id: originalPacedTrain.train_schedule_set_id,
      },
      dispatch,
      upsertTrainSchedules
    );

    return { success: true, trainScheduleId, originalPacedTrain, occurrenceId };
  }

  // ========== user is editing an existing paced train ==========

  // Reconcile existing exceptions with the new paced train settings and newly added ones
  // Note: exceptions are reset by the backend when cadence/interval changes
  const intervalChanged =
    updatedTrainSchedule.paced.interval !== originalPacedTrain.paced.interval.toISOString() ||
    updatedTrainSchedule.paced.time_window !== originalPacedTrain.paced.timeWindow.toISOString();

  // Reconcile remaining exceptions with the new paced train settings and newly added ones
  const {
    exceptions: reconciledExceptions,
    modifiedExceptions: exceptionsToUpdate,
    exceptionsToDeleteIds,
  } = checkChangeGroups(
    updatedTrainSchedule,
    updatedTrainSchedule.paced,
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
      ...updatedTrainSchedule,
      train_schedule_set_id: originalPacedTrain.train_schedule_set_id,
      ...(updatedTrainSchedule.paced && {
        paced: { ...updatedTrainSchedule.paced, exceptions: finalExceptions },
      }),
    },
    dispatch,
    upsertTrainSchedules
  );

  return { success: true, trainScheduleId, originalPacedTrain, occurrenceId };
}

const useUpdateTrainSchedule = (
  setIsWorking: (isWorking: boolean) => void,
  setDisplayTrainScheduleManagement: (type: string) => void,
  upsertTrainSchedules: (trainSchedules: TrainScheduleResponse[]) => void,
  setTrainScheduleToEditData: (trainScheduleToEditData?: TrainScheduleToEditData) => void,
  trainScheduleToEditData?: TrainScheduleToEditData
) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'manageTrainSchedule',
  });
  const dispatch = useAppDispatch();

  const { timetableId } = useScenarioContext();

  const confName = useSelector(getName);
  const simulationConf = useSelector(getOperationalStudiesConf);
  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);
  const startTime = useSelector(getStartTime);
  const addedExceptions = useSelector(getAddedExceptions);

  const onUpdateSuccess = (editData: TrainScheduleToEditData) => {
    const { trainScheduleId } = editData;
    const editedTrainId =
      editData.occurrenceId ?? formatEditoastIdToPacedTrainId(editData.trainScheduleId);

    dispatch(
      setSuccess({
        title:
          simulationConf.editingTrainType === 'uniqueTrain'
            ? t('uniqueTrainUpdated')
            : t('pacedTrainUpdated'),
        text: `${confName}: ${startTime.toLocaleString()}`,
      })
    );
    dispatch(updateAlreadySelectedTrainId(editedTrainId));

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

  return async () => {
    if (!trainScheduleToEditData) return;

    setIsWorking(true);

    try {
      const result = await updateTrainSchedule({
        upsertTrainSchedules,
        trainScheduleId: trainScheduleToEditData.trainScheduleId,
        originalPacedTrain: trainScheduleToEditData.originalPacedTrain,
        occurrenceId: trainScheduleToEditData.occurrenceId,
        dispatch,
        timetableId,
        addedExceptions,
        updatedTrainSchedule: formatTrainSchedulePayload(simulationConf),
      });

      if (result.success) {
        onUpdateSuccess({
          trainScheduleId: result.trainScheduleId,
          originalPacedTrain: result.originalPacedTrain,
          occurrenceId: result.occurrenceId,
        });
      } else {
        for (const errorCode of result.errorCodes) {
          dispatch(
            setFailure({
              name: t('errorMessages.trainScheduleTitle'),
              message: t(`errorMessages.${errorCode}`),
            })
          );
        }
      }
    } finally {
      setIsWorking(false);
    }
  };
};

export default useUpdateTrainSchedule;
