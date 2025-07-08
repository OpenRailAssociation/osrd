import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { MANAGE_TIMETABLE_ITEM_TYPES } from 'applications/operationalStudies/consts';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import checkCurrentConfig from 'modules/timetableItem/components/ManageTimetableItem/helpers/checkCurrentConfig';
import {
  storePacedTrain,
  storeTrainSchedule,
} from 'modules/timetableItem/helpers/updateTimetableItemHelpers';
import { setSuccess } from 'reducers/main';
import { clearAddedExceptionsList } from 'reducers/osrdconf/operationalStudiesConf';
import {
  getName,
  getStartTime,
  getOperationalStudiesConf,
  getOperationalStudiesTimetableID,
} from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type {
  TimetableItemId,
  TimetableItem,
  TrainId,
  TimetableItemToEditData,
} from 'reducers/osrdconf/types';
import { updateSelectedTrainId } from 'reducers/simulationResults';
import { useAppDispatch } from 'store';
import {
  extractPacedTrainIdFromOccurrenceId,
  formatPacedTrainIdToIndexedOccurrenceId,
  isOccurrenceId,
  isPacedTrainId,
} from 'utils/trainId';

import {
  formatPacedTrainPayload,
  formatTimetableItemPayload,
} from '../helpers/formatTimetableItemPayload';

const useUpdateTimetableItem = (
  setIsWorking: (isWorking: boolean) => void,
  setDisplayTimetableItemManagement: (type: string) => void,
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void,
  removeTimetableItems: (timetableItems: TimetableItemId[]) => void,
  setTimetableItemIdToEdit: (timetableItemToEditData?: TimetableItemToEditData) => void,
  timetableItemToEditData?: TimetableItemToEditData,
  selectedTrainId?: TrainId
) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTimetableItem' });
  const dispatch = useAppDispatch();
  const confName = useSelector(getName);
  const timetableId = useSelector(getOperationalStudiesTimetableID);
  const simulationConf = useSelector(getOperationalStudiesConf);
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

    let trainIdToSelect: TrainId | undefined;
    if (simulationConf.editingItemType !== 'trainSchedule') {
      const updatedItem = await storePacedTrain(
        timetableItemId,
        // When editing an occurrence, timetableItemToEditData will contain the original paced train
        // informations and the occurrence id being modified.
        // The user has modified some fields that have been saved in the store (simulationConf).
        // The function will compare these original paced train informations with the one
        // from the store and save the differences in the exception property of the original paced train.
        formatPacedTrainPayload(simulationConf, rollingStock!.name, timetableItemToEditData),
        timetableId!,
        dispatch,
        upsertTimetableItems,
        removeTimetableItems
      );
      // if the selected TimetableItem is an Occurrence of the edited PacedTrain, keep it selected
      // else select the first Occurrence by default
      trainIdToSelect =
        selectedTrainId &&
        isOccurrenceId(selectedTrainId) &&
        extractPacedTrainIdFromOccurrenceId(selectedTrainId) === timetableItemId
          ? selectedTrainId
          : formatPacedTrainIdToIndexedOccurrenceId(updatedItem.id, 0);
    } else {
      const updatedItem = await storeTrainSchedule(
        timetableItemId,
        formatTimetableItemPayload(simulationConf, rollingStock!.name),
        timetableId!,
        dispatch,
        upsertTimetableItems,
        removeTimetableItems
      );
      trainIdToSelect = updatedItem.id;
    }

    // dispatch success and update the selected train id
    dispatch(
      setSuccess({
        title: isPacedTrainId(timetableItemId) ? t('pacedTrainUpdated') : t('trainScheduleUpdated'),
        text: `${confName}: ${startTime.toLocaleString()}`,
      })
    );
    dispatch(clearAddedExceptionsList());
    dispatch(updateSelectedTrainId(trainIdToSelect));
    setDisplayTimetableItemManagement(MANAGE_TIMETABLE_ITEM_TYPES.none);
    setTimetableItemIdToEdit(undefined);
  };
};

export default useUpdateTimetableItem;
