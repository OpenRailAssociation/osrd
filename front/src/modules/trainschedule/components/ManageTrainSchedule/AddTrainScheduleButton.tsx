import { Plus } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { InfraState, TrainScheduleBase } from 'common/api/osrdEditoastApi';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import trainNameWithNum from 'modules/trainschedule/components/ManageTrainSchedule/helpers/trainNameHelper';
import { setFailure, setSuccess } from 'reducers/main';
import { getOperationalStudiesConf } from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type { TrainScheduleResultWithTrainId } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { isoDateToMs, isoDateWithTimezoneToSec } from 'utils/date';
import { castErrorToFailure } from 'utils/error';
import { sec2time } from 'utils/timeManipulation';
import { formatEditoastTrainIdToTrainScheduleId } from 'utils/trainId';

import checkCurrentConfig from './helpers/checkCurrentConfig';
import formatTrainSchedulePayload from './helpers/formatTrainSchedulePayload';

type AddTrainScheduleButtonProps = {
  infraState?: InfraState;
  setIsWorking: (isWorking: boolean) => void;
  upsertTrainSchedules: (trainSchedules: TrainScheduleResultWithTrainId[]) => void;
  dtoImport: () => void;
};

const AddTrainScheduleButton = ({
  infraState,
  setIsWorking,
  upsertTrainSchedules,
  dtoImport,
}: AddTrainScheduleButtonProps) => {
  const [postTrainSchedule] =
    osrdEditoastApi.endpoints.postTimetableByIdTrainSchedules.useMutation();
  const dispatch = useAppDispatch();
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);

  const simulationConf = useSelector(getOperationalStudiesConf);

  // TODO TS2 : remove this when rollingStockName will replace rollingStockId in the store
  const { rollingStock } = useStoreDataForRollingStockSelector();

  const createTrainSchedules = async () => {
    const validTrainConfig = checkCurrentConfig(simulationConf, t, dispatch, rollingStock?.name);

    if (validTrainConfig) {
      const { timetableId, firstStartTime, trainCount, trainDelta, trainStep, baseTrainName } =
        validTrainConfig;

      setIsWorking(true);
      const formattedStartTimeMs = isoDateToMs(firstStartTime);

      const trainScheduleParams: TrainScheduleBase[] = [];
      let actualTrainCount = 1;

      for (let nb = 1; nb <= trainCount; nb += 1) {
        const newStartTime = new Date(formattedStartTimeMs + 1000 * 60 * trainDelta * (nb - 1));
        const trainName = trainNameWithNum(baseTrainName, actualTrainCount, trainCount);

        const trainSchedule = formatTrainSchedulePayload(validTrainConfig, trainName, newStartTime);
        trainScheduleParams.push({ ...trainSchedule });
        actualTrainCount += trainStep;
      }

      try {
        const newTrainSchedules = await postTrainSchedule({
          id: timetableId,
          body: trainScheduleParams,
        }).unwrap();

        const formattedNewTrainSchedule: TrainScheduleResultWithTrainId[] = newTrainSchedules.map(
          (trainSchedule) => ({
            ...trainSchedule,
            id: formatEditoastTrainIdToTrainScheduleId(trainSchedule.id),
          })
        );

        dispatch(
          setSuccess({
            title: t('trainAdded'),
            text: `${baseTrainName}: ${sec2time(isoDateWithTimezoneToSec(firstStartTime))}`,
          })
        );
        setIsWorking(false);
        dtoImport();
        upsertTrainSchedules(formattedNewTrainSchedule);
      } catch (e) {
        setIsWorking(false);
        dispatch(setFailure(castErrorToFailure(e)));
      }
    }
  };

  return (
    <button
      className="btn btn-primary mb-2"
      type="button"
      disabled={infraState !== 'CACHED'}
      onClick={createTrainSchedules}
      data-testid="add-train-schedules"
    >
      <span className="mr-2">
        <Plus size="lg" />
      </span>
      {t('addTrainSchedule')}
    </button>
  );
};

export default AddTrainScheduleButton;
