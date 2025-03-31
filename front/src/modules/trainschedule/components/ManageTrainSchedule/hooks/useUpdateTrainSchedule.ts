import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import checkCurrentConfig from 'modules/trainschedule/components/ManageTrainSchedule/helpers/checkCurrentConfig';
import {
  storePacedTrain,
  storeTrainSchedule,
} from 'modules/trainschedule/components/ManageTrainSchedule/helpers/updateTimetableItemHelper';
import { setSuccess } from 'reducers/main';
import {
  getName,
  getStartTime,
  getOperationalStudiesConf,
  getOperationalStudiesTimetableID,
} from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type { TimetableItemId, TimetableItemWithTimetableId } from 'reducers/osrdconf/types';
import { updateSelectedTrainId } from 'reducers/simulationResults';
import { getUserPreferences } from 'reducers/user/userSelectors';
import { useAppDispatch } from 'store';
import { isPacedTrain, isTrainSchedule } from 'utils/trainId';

import { formatPacedTrainPayload } from '../helpers/formatTimetableItemPayload';
import formatTrainSchedulePayload from '../helpers/formatTrainSchedulePayload';

const useUpdateTrainSchedule = (
  setIsWorking: (isWorking: boolean) => void,
  setDisplayTrainScheduleManagement: (type: string) => void,
  upsertTimetableItems: (timetableItems: TimetableItemWithTimetableId[]) => void,
  removeTimetableItems: (timetableItems: TimetableItemId[]) => void,
  setTrainIdToEdit: (trainIdToEdit?: TimetableItemId) => void,
  dtoImport: () => void,
  trainIdToEdit?: TimetableItemId
) => {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const dispatch = useAppDispatch();
  const { showPacedTrains } = useSelector(getUserPreferences);
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

    if (!formattedSimulationConf || !trainIdToEdit) return;

    setIsWorking(true);

    let updatedTimetableItem: TimetableItemWithTimetableId;
    if (
      !showPacedTrains ||
      formattedSimulationConf.editingTrainIsPacedTrain === isPacedTrain(trainIdToEdit)
    ) {
      // handle item update without changing type
      if (isTrainSchedule(trainIdToEdit)) {
        updatedTimetableItem = await storeTrainSchedule(
          trainIdToEdit,
          formatTrainSchedulePayload(formattedSimulationConf, confName, startTime),
          timetableId!,
          dispatch,
          upsertTimetableItems,
          removeTimetableItems
        );
      } else {
        updatedTimetableItem = await storePacedTrain(
          trainIdToEdit,
          formatPacedTrainPayload(formattedSimulationConf),
          timetableId!,
          dispatch,
          upsertTimetableItems,
          removeTimetableItems
        );
      }
    } else if (isPacedTrain(trainIdToEdit)) {
      // handle item update with changing type
      updatedTimetableItem = await storeTrainSchedule(
        trainIdToEdit,
        formatTrainSchedulePayload(formattedSimulationConf, confName, startTime),
        timetableId!,
        dispatch,
        upsertTimetableItems,
        removeTimetableItems
      );
    } else {
      updatedTimetableItem = await storePacedTrain(
        trainIdToEdit,
        formatPacedTrainPayload(formattedSimulationConf),
        timetableId!,
        dispatch,
        upsertTimetableItems,
        removeTimetableItems
      );
    }

    // dispatch success and update the selected train id
    dtoImport();
    dispatch(
      setSuccess({
        title: isPacedTrain(trainIdToEdit) ? t('pacedTrainUpdated') : t('trainScheduleUpdated'),
        text: `${confName}: ${startTime.toLocaleString()}`,
      })
    );
    if (isTrainSchedule(updatedTimetableItem.id))
      dispatch(updateSelectedTrainId(updatedTimetableItem.id));
    setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.none);
    setTrainIdToEdit(undefined);
  };
};

export default useUpdateTrainSchedule;
