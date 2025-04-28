import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import checkCurrentConfig from 'modules/trainschedule/components/ManageTrainSchedule/helpers/checkCurrentConfig';
import {
  storePacedTrain,
  storeTrainSchedule,
} from 'modules/trainschedule/helpers/updateTimetableItemHelpers';
import { setSuccess } from 'reducers/main';
import {
  getName,
  getStartTime,
  getOperationalStudiesConf,
  getOperationalStudiesTimetableID,
} from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type {
  TimetableItemId,
  TimetableItemWithTimetableId,
  TrainId,
} from 'reducers/osrdconf/types';
import { updateSelectedTrainId } from 'reducers/simulationResults';
import { useAppDispatch } from 'store';
import {
  extractPacedTrainIdFromOccurrenceId,
  formatPacedTrainIdToOccurrenceId,
  isOccurrence,
  isPacedTrain,
} from 'utils/trainId';

import {
  formatPacedTrainPayload,
  formatTimetableItemPayload,
} from '../helpers/formatTimetableItemPayload';

const useUpdateTimetableItem = (
  setIsWorking: (isWorking: boolean) => void,
  setDisplayTrainScheduleManagement: (type: string) => void,
  upsertTimetableItems: (timetableItems: TimetableItemWithTimetableId[]) => void,
  removeTimetableItems: (timetableItems: TimetableItemId[]) => void,
  setTimetableItemIdToEdit: (timetableItemIdToEdit?: TimetableItemId) => void,
  timetableItemIdToEdit?: TimetableItemId,
  selectedTrainId?: TrainId
) => {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const dispatch = useAppDispatch();
  const confName = useSelector(getName);
  const timetableId = useSelector(getOperationalStudiesTimetableID);
  const simulationConf = useSelector(getOperationalStudiesConf);
  const startTime = useSelector(getStartTime);
  const { rollingStock } = useStoreDataForRollingStockSelector({
    rollingStockId: simulationConf.rollingStockID,
  });

  return async function submitConfUpdateTrainSchedules() {
    const formattedSimulationConf = checkCurrentConfig(
      simulationConf,
      t,
      dispatch,
      rollingStock?.name
    );

    if (!formattedSimulationConf || !timetableItemIdToEdit) return;

    setIsWorking(true);

    let trainIdToSelect: TrainId | undefined;
    if (formattedSimulationConf.editingTrainIsPacedTrain) {
      const updatedItem = await storePacedTrain(
        timetableItemIdToEdit,
        formatPacedTrainPayload(formattedSimulationConf),
        timetableId!,
        dispatch,
        upsertTimetableItems,
        removeTimetableItems
      );
      // if the selected TimetableItem is an Occurrence of the edited PacedTrain, keep it selected
      // else select the first Occurrence by default
      trainIdToSelect =
        selectedTrainId &&
        isOccurrence(selectedTrainId) &&
        extractPacedTrainIdFromOccurrenceId(selectedTrainId) === timetableItemIdToEdit
          ? selectedTrainId
          : formatPacedTrainIdToOccurrenceId(updatedItem.id, 0);
    } else {
      const updatedItem = await storeTrainSchedule(
        timetableItemIdToEdit,
        formatTimetableItemPayload(formattedSimulationConf),
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
        title: isPacedTrain(timetableItemIdToEdit)
          ? t('pacedTrainUpdated')
          : t('trainScheduleUpdated'),
        text: `${confName}: ${startTime.toLocaleString()}`,
      })
    );
    dispatch(updateSelectedTrainId(trainIdToSelect));
    setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.none);
    setTimetableItemIdToEdit(undefined);
  };
};

export default useUpdateTimetableItem;
