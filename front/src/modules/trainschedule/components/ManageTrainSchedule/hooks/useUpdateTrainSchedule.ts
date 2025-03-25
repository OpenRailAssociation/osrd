import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import checkCurrentConfig from 'modules/trainschedule/components/ManageTrainSchedule/helpers/checkCurrentConfig';
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
import {
  formatEditoastTrainIdToPacedTrainId,
  formatEditoastTrainIdToTrainScheduleId,
  formatPacedTrainIdToEditoastTrainId,
  formatTrainScheduleIdToEditoastTrainId,
  isPacedTrain,
  isTrainSchedule,
} from 'utils/trainId';

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

  const [postTrainSchedule] =
    osrdEditoastApi.endpoints.postTimetableByIdTrainSchedules.useMutation();
  const [postPacedTrain] = osrdEditoastApi.endpoints.postTimetableByIdPacedTrains.useMutation();
  const [putTrainScheduleById] = osrdEditoastApi.endpoints.putTrainScheduleById.useMutation();
  const [putPacedTrainById] = osrdEditoastApi.endpoints.putPacedTrainById.useMutation();
  const [deleteTrainSchedules] = osrdEditoastApi.endpoints.deleteTrainSchedule.useMutation();
  const [deletePacedTrains] = osrdEditoastApi.endpoints.deletePacedTrain.useMutation();

  return async function submitConfUpdateTrainSchedules() {
    const formattedSimulationConf = checkCurrentConfig(
      simulationConf,
      t,
      dispatch,
      rollingStock?.name
    );

    if (!formattedSimulationConf || !trainIdToEdit) return;

    setIsWorking(true);

    let editedItemId: TimetableItemId;

    // handle item update without changing type
    if (
      !showPacedTrains ||
      formattedSimulationConf.editingTrainIsPacedTrain === isPacedTrain(trainIdToEdit)
    ) {
      let newItem: TimetableItemWithTimetableId;
      if (isTrainSchedule(trainIdToEdit)) {
        const trainSchedule = formatTrainSchedulePayload(
          formattedSimulationConf,
          confName,
          startTime
        );
        const newTrainsSchedule = await putTrainScheduleById({
          id: formatTrainScheduleIdToEditoastTrainId(trainIdToEdit),
          trainScheduleForm: trainSchedule,
        }).unwrap();
        newItem = {
          ...newTrainsSchedule,
          id: trainIdToEdit,
        };
      } else {
        const pacedTrain = formatPacedTrainPayload(formattedSimulationConf);
        await putPacedTrainById({
          id: formatPacedTrainIdToEditoastTrainId(trainIdToEdit),
          body: pacedTrain,
        }).unwrap();
        newItem = {
          ...pacedTrain,
          timetable_id: timetableId!,
          id: trainIdToEdit,
        };
      }

      upsertTimetableItems([newItem]);
      editedItemId = trainIdToEdit;
    }

    // handle item update with changing type
    else {
      let promises: [Promise<unknown>, Promise<TimetableItemWithTimetableId>];

      // delete the paced train and create the train schedule
      if (isPacedTrain(trainIdToEdit)) {
        const trainSchedule = formatTrainSchedulePayload(
          formattedSimulationConf,
          confName,
          startTime
        );
        promises = [
          deletePacedTrains({
            body: { ids: [formatPacedTrainIdToEditoastTrainId(trainIdToEdit)] },
          }).unwrap(),
          postTrainSchedule({
            id: timetableId!,
            body: [trainSchedule],
          })
            .unwrap()
            .then((newItems) => {
              const newItem = newItems[0];
              return { ...newItem, id: formatEditoastTrainIdToTrainScheduleId(newItem.id) };
            }),
        ];
      }

      // delete the train schedule and create the paced train
      else {
        const pacedTrain = formatPacedTrainPayload(formattedSimulationConf);
        promises = [
          deleteTrainSchedules({
            body: { ids: [formatTrainScheduleIdToEditoastTrainId(trainIdToEdit)] },
          }).unwrap(),
          postPacedTrain({
            id: timetableId!,
            body: [pacedTrain],
          })
            .unwrap()
            .then((newItems) => {
              const newItem = newItems[0];
              return { ...newItem, id: formatEditoastTrainIdToPacedTrainId(newItem.id) };
            }),
        ];
      }

      const [_deletedItem, newItem] = await Promise.all(promises);
      removeTimetableItems([trainIdToEdit]);
      editedItemId = newItem.id;
      upsertTimetableItems([newItem]);
    }

    // dispatch success and update the selected train id
    dtoImport();
    dispatch(
      setSuccess({
        title: isPacedTrain(trainIdToEdit) ? t('pacedTrainUpdated') : t('trainScheduleUpdated'),
        text: `${confName}: ${startTime.toLocaleString()}`,
      })
    );
    if (isTrainSchedule(editedItemId)) dispatch(updateSelectedTrainId(editedItemId));
    setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.none);
    setTrainIdToEdit(undefined);
  };
};

export default useUpdateTrainSchedule;
