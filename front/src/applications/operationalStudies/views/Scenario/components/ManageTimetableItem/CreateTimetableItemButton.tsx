import { Plus } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import { setFailure, setSuccess } from 'reducers/main';
import { clearAddedExceptionsList } from 'reducers/osrdconf/operationalStudiesConf';
import { getOperationalStudiesConf } from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type {
  PacedTrainWithPacedTrainId,
  TimetableItem,
  TrainScheduleWithTrainId,
} from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';
import { formatEditoastIdToPacedTrainId, formatEditoastIdToTrainScheduleId } from 'utils/trainId';

import checkCurrentConfig from './helpers/checkCurrentConfig';
import {
  formatPacedTrainPayload,
  formatTimetableItemPayload,
} from './helpers/formatTimetableItemPayload';

type CreateTimetableItemButtonProps = {
  setIsWorking: (isWorking: boolean) => void;
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void;
  isPacedTrainMode: boolean;
};

/**
 * Create train schedules and paced trains
 */
const CreateTimetableItemButton = ({
  setIsWorking,
  upsertTimetableItems,
  isPacedTrainMode,
}: CreateTimetableItemButtonProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTimetableItem' });

  const { workerStatus, timetableId } = useScenarioContext();

  const simulationConf = useSelector(getOperationalStudiesConf);

  // TODO TS2 : remove this when rollingStockName will replace rollingStockId in the store
  const { rollingStock } = useStoreDataForRollingStockSelector({
    rollingStockId: simulationConf.rollingStockID,
  });

  const [postTrainSchedule] =
    osrdEditoastApi.endpoints.postTimetableByIdTrainSchedules.useMutation();
  const [postPacedTrain] = osrdEditoastApi.endpoints.postTimetableByIdPacedTrains.useMutation();

  const createTrainSchedules = async () => {
    if (!checkCurrentConfig(simulationConf, t, dispatch, rollingStock?.name)) return;

    const baseTrainName = simulationConf.name;

    setIsWorking(true);

    try {
      if (isPacedTrainMode) {
        const pacedTrainPayload = formatPacedTrainPayload(simulationConf, rollingStock!.name);
        const newPacedTrain = await postPacedTrain({
          id: timetableId,
          body: [pacedTrainPayload],
        }).unwrap();

        // We can only add one paced train at a time
        const formattedNewPacedTrain: PacedTrainWithPacedTrainId = {
          ...newPacedTrain.at(0)!,
          id: formatEditoastIdToPacedTrainId(newPacedTrain.at(0)!.id),
        };

        dispatch(
          setSuccess({
            title: t('pacedTrains.added'),
            text: `${baseTrainName}: ${simulationConf.startTime.toLocaleTimeString()}`,
          })
        );
        if (simulationConf.editingItemType !== 'trainSchedule') {
          dispatch(clearAddedExceptionsList());
        }
        upsertTimetableItems([formattedNewPacedTrain]);
      } else {
        const trainSchedulePayload = formatTimetableItemPayload(simulationConf, rollingStock!.name);
        const newTrainSchedule = await postTrainSchedule({
          id: timetableId,
          body: [trainSchedulePayload],
        }).unwrap();

        // We can only add one train schedule at a time
        const formattedNewTrainSchedule: TrainScheduleWithTrainId = {
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
  };

  return (
    <button
      className="btn btn-primary mb-2"
      type="button"
      disabled={workerStatus !== 'READY'}
      onClick={createTrainSchedules}
      data-testid="create-timetable-item-button"
    >
      <span className="mr-2">
        <Plus size="lg" />
      </span>
      {isPacedTrainMode ? t('addPacedTrain') : t('addTrainSchedule')}
    </button>
  );
};

export default CreateTimetableItemButton;
