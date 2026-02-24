import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { MANAGE_TIMETABLE_ITEM_TYPES } from 'applications/operationalStudies/views/Scenario/consts';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import { storePacedTrain } from 'modules/timetableItem/helpers/updateTimetableItemHelpers';
import { setSuccess } from 'reducers/main';
import { clearAddedExceptionsList } from 'reducers/osrdconf/operationalStudiesConf';
import {
  getName,
  getStartTime,
  getOperationalStudiesConf,
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
import { formatPacedTrainPayload } from '../helpers/formatTimetableItemPayload';

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

  const confName = useSelector(getName);
  const simulationConf = useSelector(getOperationalStudiesConf);
  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);
  const startTime = useSelector(getStartTime);
  const { rollingStock } = useStoreDataForRollingStockSelector({
    rollingStockId: simulationConf.rollingStockID,
  });

  return async function submitConfUpdateTrainSchedules() {
    if (
      !timetableItemToEditData ||
      !checkCurrentConfig(simulationConf, t, dispatch, rollingStock?.name)
    )
      return;

    const { timetableItemId } = timetableItemToEditData;

    setIsWorking(true);

    // TODO: extract updated exceptions from the return to handle updating exceptions
    const { newTrainSchedulePayload } = formatPacedTrainPayload(
      simulationConf,
      rollingStock!.name,
      timetableItemToEditData
    );

    const updatedItem = await storePacedTrain(
      timetableItemId,
      // When editing an occurrence, timetableItemToEditData will contain the original paced train
      // information and the occurrence id being modified.
      // The user has modified some fields that have been saved in the store (simulationConf).
      // The function will compare this original paced train information with the one
      // from the store and save the differences in the exception property of the original paced train.
      {
        ...newTrainSchedulePayload,
        train_schedule_set_id: timetableItemToEditData.originalPacedTrain.train_schedule_set_id,
      },
      dispatch,
      upsertTimetableItems
    );

    // if the selected TimetableItem is an Occurrence of the edited PacedTrain, keep it selected
    // else select the first Occurrence by default
    const trainIdToSelect =
      (selectedTrainId &&
        isOccurrenceId(selectedTrainId) &&
        extractEditoastIdFromPacedTrainId(extractPacedTrainIdFromOccurrenceId(selectedTrainId)) ===
          timetableItemId) ||
      !updatedItem.paced
        ? selectedTrainId
        : formatEditoastIdToIndexedOccurrenceId({
            pacedTrainId: updatedItem.id,
            occurrenceIndex: 0,
          });

    // dispatch success and update the selected train id
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
      trainIdUsedForProjection.includes(`_${updatedItem.id}_`) &&
      !updatedItem.paced
    ) {
      dispatch(updateTrainIdUsedForProjection(formatEditoastIdToPacedTrainId(updatedItem.id)));
    }

    // close the modal
    dispatch(clearAddedExceptionsList());
    setDisplayTimetableItemManagement(MANAGE_TIMETABLE_ITEM_TYPES.none);
    setTimetableItemIdToEdit(undefined);
  };
};

export default useUpdateTimetableItem;
