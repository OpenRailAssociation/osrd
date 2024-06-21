import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useOsrdConfSelectors } from 'common/osrdContext';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import checkCurrentConfig from 'modules/trainschedule/components/ManageTrainSchedule/helpers/checkCurrentConfig';
import { setFailure, setSuccess } from 'reducers/main';
import { type OsrdConfState } from 'reducers/osrdconf/types';
import { updateSelectedTrainId } from 'reducers/osrdsimulation/actions';
import { useAppDispatch } from 'store';
import { formatToIsoDate } from 'utils/date';
import { castErrorToFailure } from 'utils/error';

import formatTrainSchedulePayload from '../helpers/formatTrainSchedulePayload';

const useUpdateTrainSchedule = (
  setIsWorking: (isWorking: boolean) => void,
  setDisplayTrainScheduleManagement: (type: string) => void,
  setTrainResultsToFetch: (trainSchedulesIDs?: number[]) => void,
  setTrainIdToEdit: (trainIdToEdit?: number) => void,
  trainIdToEdit?: number
) => {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const [putV2TrainScheduleById] = osrdEditoastApi.endpoints.putV2TrainScheduleById.useMutation();
  const dispatch = useAppDispatch();
  const { getConf, getName, getStartTime } = useOsrdConfSelectors();
  const confName = useSelector(getName);
  const simulationConf = useSelector(getConf);
  const startTime = useSelector(getStartTime);
  const { rollingStock } = useStoreDataForRollingStockSelector();

  return async function submitConfUpdateTrainSchedules() {
    const formattedSimulationConf = checkCurrentConfig(
      simulationConf as OsrdConfState,
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
      try {
        await putV2TrainScheduleById({
          id: trainIdToEdit,
          trainScheduleForm: trainSchedule,
        }).unwrap();

        setTrainResultsToFetch([trainIdToEdit]);
        dispatch(
          setSuccess({
            title: t('trainUpdated'),
            text: `${confName}: ${formatToIsoDate(startTime, true)}`,
          })
        );
        dispatch(updateSelectedTrainId(trainIdToEdit));
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
