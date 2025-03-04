import { Plus } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { InfraState, PacedTrain, TrainScheduleBase } from 'common/api/osrdEditoastApi';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import trainNameWithNum from 'modules/trainschedule/components/ManageTrainSchedule/helpers/trainNameHelper';
import { setFailure, setSuccess } from 'reducers/main';
import { getOperationalStudiesConf } from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type {
  PacedTrainResponseWithPacedTrainId,
  TimetableItemWithTimetableId,
  TrainScheduleResultWithTrainId,
} from 'reducers/osrdconf/types';
import { getUserPreferences } from 'reducers/user/userSelectors';
import { useAppDispatch } from 'store';
import { isoDateToMs, isoDateWithTimezoneToSec } from 'utils/date';
import { castErrorToFailure } from 'utils/error';
import { sec2time } from 'utils/timeManipulation';
import {
  formatEditoastTrainIdToPacedTrainId,
  formatEditoastTrainIdToTrainScheduleId,
} from 'utils/trainId';

import checkCurrentConfig from './helpers/checkCurrentConfig';
import formatTimetableItemPayload from './helpers/formatTimetableItemPayload';
import formatTrainSchedulePayload from './helpers/formatTrainSchedulePayload';

type AddTrainScheduleButtonProps = {
  infraState?: InfraState;
  setIsWorking: (isWorking: boolean) => void;
  upsertTimetableItems: (timetableItems: TimetableItemWithTimetableId[]) => void;
  dtoImport: () => void;
  isPacedTrainMode: boolean;
};

const AddTrainScheduleButton = ({
  infraState,
  setIsWorking,
  upsertTimetableItems,
  dtoImport,
  isPacedTrainMode,
}: AddTrainScheduleButtonProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);

  const simulationConf = useSelector(getOperationalStudiesConf);
  const { showPacedTrains } = useSelector(getUserPreferences);

  // TODO TS2 : remove this when rollingStockName will replace rollingStockId in the store
  const { rollingStock } = useStoreDataForRollingStockSelector({
    rollingStockId: simulationConf.rollingStockID,
  });

  const [postTrainSchedule] =
    osrdEditoastApi.endpoints.postTimetableByIdTrainSchedules.useMutation();
  const [postPacedTrain] = osrdEditoastApi.endpoints.postTimetableByIdPacedTrains.useMutation();

  const createTrainSchedules = async () => {
    const validTimetableItemConfig = checkCurrentConfig(
      simulationConf,
      t,
      dispatch,
      rollingStock?.name
    );

    if (!validTimetableItemConfig) return;

    const { timetableId, firstStartTime, trainCount, trainDelta, trainStep, baseTrainName } =
      validTimetableItemConfig;

    setIsWorking(true);

    if (showPacedTrains) {
      try {
        if (isPacedTrainMode) {
          const basePacedTrainPayload = formatTimetableItemPayload(validTimetableItemConfig);
          const pacedTrainPayload: PacedTrain = {
            ...basePacedTrainPayload,
            paced: {
              duration: validTimetableItemConfig.timeRangeDuration,
              step: validTimetableItemConfig.cadence,
            },
          };
          const newPacedTrain = await postPacedTrain({
            id: timetableId,
            body: [pacedTrainPayload],
          }).unwrap();

          // We can only add one paced train at a time
          const formattedNewPacedTrain: PacedTrainResponseWithPacedTrainId = {
            ...newPacedTrain.at(0)!,
            id: formatEditoastTrainIdToPacedTrainId(newPacedTrain.at(0)!.id),
          };

          dispatch(
            setSuccess({
              title: t('pacedTrains.added'),
              text: `${baseTrainName}: ${sec2time(isoDateWithTimezoneToSec(firstStartTime))}`,
            })
          );
          upsertTimetableItems([formattedNewPacedTrain]);
        } else {
          const trainSchedulePayload = formatTimetableItemPayload(validTimetableItemConfig);
          const newTrainSchedule = await postTrainSchedule({
            id: timetableId,
            body: [trainSchedulePayload],
          }).unwrap();

          // We can only add one train schedule at a time
          const formattedNewTrainSchedule: TrainScheduleResultWithTrainId = {
            ...newTrainSchedule.at(0)!,
            id: formatEditoastTrainIdToTrainScheduleId(newTrainSchedule.at(0)!.id),
          };

          dispatch(
            setSuccess({
              title: t('trainAdded'),
              text: `${baseTrainName}: ${sec2time(isoDateWithTimezoneToSec(firstStartTime))}`,
            })
          );
          upsertTimetableItems([formattedNewTrainSchedule]);
        }
      } catch (e) {
        dispatch(setFailure(castErrorToFailure(e)));
      } finally {
        setIsWorking(false);
      }
      // TODO Paced trains : remove the else in https://github.com/OpenRailAssociation/osrd/issues/10791
    } else {
      const formattedStartTimeMs = isoDateToMs(firstStartTime);

      const trainScheduleParams: TrainScheduleBase[] = [];
      let actualTrainCount = 1;

      for (let nb = 1; nb <= trainCount; nb += 1) {
        const newStartTime = new Date(formattedStartTimeMs + 1000 * 60 * trainDelta * (nb - 1));
        const trainName = trainNameWithNum(baseTrainName, actualTrainCount, trainCount);

        const trainSchedule = formatTrainSchedulePayload(
          validTimetableItemConfig,
          trainName,
          newStartTime
        );
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
        upsertTimetableItems(formattedNewTrainSchedule);
      } catch (e) {
        setIsWorking(false);
        dispatch(setFailure(castErrorToFailure(e)));
      }
    }
    dtoImport();
  };

  return (
    <button
      className="btn btn-primary mb-2"
      type="button"
      disabled={infraState !== 'CACHED'}
      onClick={createTrainSchedules}
      data-testid="add-train"
    >
      <span className="mr-2">
        <Plus size="lg" />
      </span>
      {!showPacedTrains && t('addTrainSchedules')}
      {showPacedTrains && (isPacedTrainMode ? t('addPacedTrain') : t('addTrainSchedule'))}
    </button>
  );
};

export default AddTrainScheduleButton;
