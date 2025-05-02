import { Plus } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { InfraState, TrainSchedule } from 'common/api/osrdEditoastApi';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import trainNameWithNum from 'modules/trainschedule/components/ManageTrainSchedule/helpers/trainNameHelper';
import { setFailure, setSuccess } from 'reducers/main';
import { getOperationalStudiesConf } from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type {
  PacedTrainResponseWithPacedTrainId,
  TimetableItem,
  TrainScheduleResponseWithTrainId,
} from 'reducers/osrdconf/types';
import { getUserPreferences } from 'reducers/user/userSelectors';
import { useAppDispatch } from 'store';
import { isoDateToMs } from 'utils/date';
import { castErrorToFailure } from 'utils/error';
import { formatEditoastIdToPacedTrainId, formatEditoastIdToTrainScheduleId } from 'utils/trainId';

import checkCurrentConfig from './helpers/checkCurrentConfig';
import {
  formatPacedTrainPayload,
  formatTimetableItemPayload,
} from './helpers/formatTimetableItemPayload';

type AddTrainScheduleButtonProps = {
  infraState?: InfraState;
  setIsWorking: (isWorking: boolean) => void;
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void;
  isPacedTrainMode: boolean;
};

const AddTrainScheduleButton = ({
  infraState,
  setIsWorking,
  upsertTimetableItems,
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
    if (!checkCurrentConfig(simulationConf, t, dispatch, rollingStock?.name)) return;

    const timetableId = simulationConf.timetableID!;
    const baseTrainName = simulationConf.name;
    const firstStartTime = simulationConf.startTime.toISOString();

    setIsWorking(true);

    if (showPacedTrains) {
      try {
        if (isPacedTrainMode) {
          const pacedTrainPayload = formatPacedTrainPayload(simulationConf, rollingStock!.name);
          const newPacedTrain = await postPacedTrain({
            id: timetableId,
            body: [pacedTrainPayload],
          }).unwrap();

          // We can only add one paced train at a time
          const formattedNewPacedTrain: PacedTrainResponseWithPacedTrainId = {
            ...newPacedTrain.at(0)!,
            id: formatEditoastIdToPacedTrainId(newPacedTrain.at(0)!.id),
          };

          dispatch(
            setSuccess({
              title: t('pacedTrains.added'),
              text: `${baseTrainName}: ${simulationConf.startTime.toLocaleTimeString()}`,
            })
          );
          upsertTimetableItems([formattedNewPacedTrain]);
        } else {
          const trainSchedulePayload = formatTimetableItemPayload(
            simulationConf,
            rollingStock!.name
          );
          const newTrainSchedule = await postTrainSchedule({
            id: timetableId,
            body: [trainSchedulePayload],
          }).unwrap();

          // We can only add one train schedule at a time
          const formattedNewTrainSchedule: TrainScheduleResponseWithTrainId = {
            ...newTrainSchedule.at(0)!,
            id: formatEditoastIdToTrainScheduleId(newTrainSchedule.at(0)!.id),
          };

          dispatch(
            setSuccess({
              title: t('trainAdded'),
              text: `${baseTrainName}: ${simulationConf.startTime.toLocaleTimeString()}`,
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
      const { trainCount, trainStep, trainDelta } = simulationConf;

      const trainScheduleParams: TrainSchedule[] = [];
      let actualTrainCount = 1;

      for (let nb = 1; nb <= trainCount; nb += 1) {
        const newStartTime = new Date(formattedStartTimeMs + 1000 * 60 * trainDelta * (nb - 1));
        const trainName = trainNameWithNum(baseTrainName, actualTrainCount, trainCount);

        const trainSchedule = formatTimetableItemPayload(simulationConf, rollingStock!.name);
        trainScheduleParams.push({
          ...trainSchedule,
          train_name: trainName,
          start_time: newStartTime.toISOString(),
        });
        actualTrainCount += trainStep;
      }

      try {
        const newTrainSchedules = await postTrainSchedule({
          id: timetableId,
          body: trainScheduleParams,
        }).unwrap();

        const formattedNewTrainSchedule: TrainScheduleResponseWithTrainId[] = newTrainSchedules.map(
          (trainSchedule) => ({
            ...trainSchedule,
            id: formatEditoastIdToTrainScheduleId(trainSchedule.id),
          })
        );

        dispatch(
          setSuccess({
            title: t('trainAdded'),
            text: `${baseTrainName}: ${simulationConf.startTime.toLocaleTimeString()}`,
          })
        );
        setIsWorking(false);
        upsertTimetableItems(formattedNewTrainSchedule);
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
