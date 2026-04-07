import { isEmpty } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { v4 as uuidV4 } from 'uuid';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import {
  checkChangeGroups,
  updatePacedTrainExceptionsList,
} from 'applications/operationalStudies/views/Scenario/components/ManageTimetableItem/helpers/buildPacedTrainException';
import { MANAGE_TIMETABLE_ITEM_TYPES } from 'applications/operationalStudies/views/Scenario/consts';
import type { PacedTrainException } from 'common/api/osrdEditoastApi';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import { findExceptionWithOccurrenceId } from 'modules/timetableItem/helpers/pacedTrain';
import {
  createExceptions,
  deleteExceptions,
  storePacedTrain,
  syncAndUpdatePacedTrain,
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
import type { TimetableItem, TrainId, TimetableItemToEditData } from 'reducers/osrdconf/types';
import { updateSelectedTrainId, updateTrainIdUsedForProjection } from 'reducers/simulationResults';
import { getTrainIdUsedForProjection } from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import {
  extractEditoastIdFromPacedTrainId,
  extractPacedTrainIdFromOccurrenceId,
  formatEditoastIdToIndexedOccurrenceId,
  formatEditoastIdToPacedTrainId,
  isOccurrenceId,
} from 'utils/trainId';

import checkCurrentConfig from '../helpers/checkCurrentConfig';
import {
  formatOccurrenceException,
  formatPacedTrainPayload,
  formatPacedTrainWithDetailsToPacedTrainPayload,
} from '../helpers/formatTimetableItemPayload';

const useUpdateTimetableItem = (
  setIsWorking: (isWorking: boolean) => void,
  setDisplayTimetableItemManagement: (type: string) => void,
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void,
  setTimetableItemIdToEdit: (timetableItemToEditData?: TimetableItemToEditData) => void,
  timetableItemToEditData?: TimetableItemToEditData,
  selectedTrainId?: TrainId
) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTimetableItem' });
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
  const handleUpdateSuccess = (timetableItemId: number, editData: TimetableItemToEditData) => {
    // if the selected TimetableItem is an Occurrence of the edited PacedTrain, keep it selected
    // else select the first Occurrence by default
    const trainIdToSelect =
      (selectedTrainId &&
        isOccurrenceId(selectedTrainId) &&
        extractEditoastIdFromPacedTrainId(extractPacedTrainIdFromOccurrenceId(selectedTrainId)) ===
          timetableItemId) ||
      !editData.originalPacedTrain.paced
        ? selectedTrainId
        : formatEditoastIdToIndexedOccurrenceId({
            pacedTrainId: timetableItemId,
            occurrenceIndex: 0,
          });

    dispatch(
      setSuccess({
        title:
          simulationConf.editingItemType === 'uniqueTrain'
            ? t('pacedTrainUpdated')
            : t('uniqueTrainUpdated'),
        text: `${confName}: ${startTime.toLocaleString()}`,
      })
    );
    dispatch(updateSelectedTrainId(trainIdToSelect));

    // if the updated train was just transformed from pacedTrain to uniqueTrain
    // and one of the occurrences was used for the projection, update the projectedTrainId
    if (
      trainIdUsedForProjection &&
      isOccurrenceId(trainIdUsedForProjection) &&
      trainIdUsedForProjection.includes(`_${timetableItemId}_`) &&
      !editData.originalPacedTrain.paced
    ) {
      dispatch(updateTrainIdUsedForProjection(formatEditoastIdToPacedTrainId(timetableItemId)));
    }

    dispatch(clearAddedExceptionsList());
    setDisplayTimetableItemManagement(MANAGE_TIMETABLE_ITEM_TYPES.none);
    setTimetableItemIdToEdit(undefined);
  };

  return async function submitConfUpdateTrainSchedules() {
    if (
      !timetableItemToEditData ||
      !checkCurrentConfig(simulationConf, t, dispatch, rollingStock?.name)
    )
      return;

    setIsWorking(true);

    const { timetableItemId, occurrenceId, originalPacedTrain } = timetableItemToEditData;

    // ========== user is editing an occurrence ==========
    if (occurrenceId) {
      const { generatedException, occurrenceIndex } = formatOccurrenceException(
        simulationConf,
        rollingStock!.name,
        timetableItemToEditData as TimetableItemToEditData & {
          occurrenceId: NonNullable<TimetableItemToEditData['occurrenceId']>;
        }
      );

      const existingException = findExceptionWithOccurrenceId(
        originalPacedTrain.paced?.exceptions ?? [],
        occurrenceId
      );

      let finalException: PacedTrainException = {
        ...generatedException,
        key: existingException?.key ?? uuidV4(),
        occurrence_index: occurrenceIndex,
      };
      if (existingException) {
        // disabled is not included in changeGroups, so we need to check separately
        if (isEmpty(generatedException) && !existingException.disabled) {
          // Exception should be deleted as there is no change compared to the paced train anymore
          // TODO_EXCEPTION: remove `!` when using TrainScheduleException type
          await deleteExceptions(dispatch, [existingException.id!]);
        } else {
          // Exception already exists -> update it with the existing id
          const toUpdate: PacedTrainException = {
            ...generatedException,
            id: existingException.id,
            // TODO_EXCEPTION: remove this when drop key in the model
            key: existingException.key,
            occurrence_index: occurrenceIndex,
          };
          await updateExceptions(dispatch, [toUpdate], timetableItemId);
          finalException = toUpdate;
        }
      } else {
        // No existing exception -> create it
        const exceptionToCreate: PacedTrainException = {
          ...generatedException,
          // TODO_EXCEPTION: remove this when drop key in the model
          key: uuidV4(),
          occurrence_index: occurrenceIndex,
        };
        const [created] = await createExceptions(
          dispatch,
          [exceptionToCreate],
          timetableItemId,
          timetableId
        );
        finalException = { ...exceptionToCreate, id: created.id };
      }

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
          id: timetableItemId,
          train_schedule_set_id: originalPacedTrain.train_schedule_set_id,
          paced: formattedPacedTrain.paced
            ? { ...formattedPacedTrain.paced, exceptions: updatedExceptions }
            : undefined,
        },
      ]);

      return handleUpdateSuccess(timetableItemId, timetableItemToEditData);
    }

    // ========== user is editing the whole paced train or transforming from an unique train ==========
    const trainSchedule = formatPacedTrainPayload(simulationConf, rollingStock!.name);

    const originalPacedExceptions = originalPacedTrain.paced?.exceptions ?? [];

    const newAddedExceptions: PacedTrainException[] = addedExceptions.map(
      ({ key, startTime: exStartTime }) => ({
        key,
        start_time: { value: exStartTime.toISOString() },
      })
    );

    // Converting a unique train into a paced train:
    // syncAndUpdatePacedTrain must be called first to make the train a paced train on the backend
    // before we can create exceptions on it.
    if (!originalPacedTrain.paced) {
      await syncAndUpdatePacedTrain(
        timetableItemId,
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
        timetableItemId,
        timetableId
      );

      // TODO: remove this part when the back will be done inserting the new exception format in TrainSchedule
      createdExceptions = created.map(
        ({ change_groups, train_schedule_id: _, timetable_id: __, ...rest }) => ({
          ...change_groups,
          ...rest,
          // TODO_EXCEPTION: remove this when drop key in the model
          key: rest.id.toString(),
        })
      );
    }

    // If we just converted a unique train to a paced train, upsert with created exceptions and return
    if (!originalPacedTrain.paced) {
      upsertTimetableItems([
        {
          ...trainSchedule,
          id: timetableItemId,
          train_schedule_set_id: originalPacedTrain.train_schedule_set_id,
          ...(trainSchedule.paced && {
            paced: { ...trainSchedule.paced, exceptions: createdExceptions },
          }),
        },
      ]);

      return handleUpdateSuccess(timetableItemId, timetableItemToEditData);
    }

    // ========== user is converting a paced train to a unique train ==========
    if (!trainSchedule.paced) {
      await storePacedTrain(
        timetableItemId,
        {
          ...trainSchedule,
          train_schedule_set_id: originalPacedTrain.train_schedule_set_id,
        },
        dispatch,
        upsertTimetableItems
      );

      return handleUpdateSuccess(timetableItemId, timetableItemToEditData);
    }

    // ========== user is editing an existing paced train ==========

    // Reconcile existing exceptions with the new paced train settings and newly added ones
    // Note: exceptions are reset by the backend when cadence/interval changes
    const {
      exceptions: reconciledExceptions,
      modifiedExceptions: exceptionsToUpdate,
      exceptionsToDeleteIds,
    } = checkChangeGroups(trainSchedule, trainSchedule.paced, originalPacedExceptions);

    if (exceptionsToDeleteIds.length > 0) {
      await deleteExceptions(dispatch, exceptionsToDeleteIds);
    }

    if (exceptionsToUpdate.length > 0) {
      await updateExceptions(dispatch, exceptionsToUpdate, timetableItemId);
    }

    const finalExceptions = [...reconciledExceptions, ...createdExceptions];

    // Store the paced train with the final exceptions list
    await storePacedTrain(
      timetableItemId,
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

    return handleUpdateSuccess(timetableItemId, timetableItemToEditData);
  };
};

export default useUpdateTimetableItem;
