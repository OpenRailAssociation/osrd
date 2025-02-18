import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import checkCurrentConfig from 'modules/trainschedule/components/ManageTrainSchedule/helpers/checkCurrentConfig';
import { setFailure, setSuccess } from 'reducers/main';
import {
  getName,
  getStartTime,
  getOperationalStudiesConf,
} from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type {
  TimetableItemId,
  TrainScheduleId,
  TrainScheduleResultWithTrainId,
} from 'reducers/osrdconf/types';
import { updateSelectedTrainId } from 'reducers/simulationResults';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';
import {
  formatEditoastTrainIdToTrainScheduleId,
  formatTrainScheduleIdToEditoastTrainId,
} from 'utils/trainId';

import formatTrainSchedulePayload from '../helpers/formatTrainSchedulePayload';

const useUpdateTrainSchedule = (
  setIsWorking: (isWorking: boolean) => void,
  setDisplayTrainScheduleManagement: (type: string) => void,
  upsertTrainSchedules: (trainSchedules: TrainScheduleResultWithTrainId[]) => void,
  setTrainIdToEdit: (trainIdToEdit?: TimetableItemId) => void,
  dtoImport: () => void,
  trainIdToEdit?: TimetableItemId
) => {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const [putTrainScheduleById] = osrdEditoastApi.endpoints.putTrainScheduleById.useMutation();
  const dispatch = useAppDispatch();
  const confName = useSelector(getName);
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

    if (formattedSimulationConf && trainIdToEdit) {
      setIsWorking(true);
      const trainSchedule = formatTrainSchedulePayload(
        formattedSimulationConf,
        confName,
        startTime
      );
      // TODO Paced train : Adapt this to handle paced trains in issue https://github.com/OpenRailAssociation/osrd/issues/10615
      try {
        const trainScheduleResult = await putTrainScheduleById({
          id: formatTrainScheduleIdToEditoastTrainId(trainIdToEdit as TrainScheduleId),
          trainScheduleForm: trainSchedule,
        }).unwrap();
        const formattedTrainScheduleResult: TrainScheduleResultWithTrainId = {
          ...trainScheduleResult,
          id: formatEditoastTrainIdToTrainScheduleId(trainScheduleResult.id),
        };
        upsertTrainSchedules([formattedTrainScheduleResult]);
        dtoImport();
        dispatch(
          setSuccess({
            title: t('trainUpdated'),
            text: `${confName}: ${startTime.toLocaleString()}`,
          })
        );
        dispatch(updateSelectedTrainId(trainIdToEdit as TrainScheduleId));
        setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.none);
        setTrainIdToEdit(undefined);
      } catch (e) {
        dispatch(setFailure(castErrorToFailure(e)));
      } finally {
        setIsWorking(false);
      }
    }
  };
};

export default useUpdateTrainSchedule;
