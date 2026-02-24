import { Plus } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import {
  createExceptions,
  createPacedTrains,
} from 'modules/timetableItem/helpers/updateTimetableItemHelpers';
import { setFailure, setSuccess } from 'reducers/main';
import { clearAddedExceptionsList } from 'reducers/osrdconf/operationalStudiesConf';
import { getOperationalStudiesConf } from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type { TimetableItem } from 'reducers/osrdconf/types';
import { updateSelectedTrainId } from 'reducers/simulationResults';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';
import { formatEditoastIdToPacedTrainId } from 'utils/trainId';

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
 * Create unique trains and paced trains
 */
const CreateTimetableItemButton = ({
  setIsWorking,
  upsertTimetableItems,
  isPacedTrainMode,
}: CreateTimetableItemButtonProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTimetableItem' });

  const { workerStatus, sandboxId, timetableId } = useScenarioContext();

  const simulationConf = useSelector(getOperationalStudiesConf);

  // TODO TS2 : remove this when rollingStockName will replace rollingStockId in the store
  const { rollingStock } = useStoreDataForRollingStockSelector({
    rollingStockId: simulationConf.rollingStockID,
  });

  const createTrainSchedules = async () => {
    if (!checkCurrentConfig(simulationConf, t, dispatch, rollingStock?.name)) return;

    setIsWorking(true);

    try {
      const payload = isPacedTrainMode
        ? formatPacedTrainPayload(simulationConf, rollingStock!.name)
        : formatTimetableItemPayload(simulationConf, rollingStock!.name);

      const { newTrainSchedulePayload, updatedExceptions } = payload;

      const formattedNewTrainSchedule: TimetableItem = (
        await createPacedTrains(dispatch, sandboxId, [newTrainSchedulePayload])
      )[0];
      dispatch(updateSelectedTrainId(formatEditoastIdToPacedTrainId(formattedNewPacedTrain.id)));

      if (updatedExceptions.length > 0) {
        await createExceptions(
          dispatch,
          updatedExceptions,
          formattedNewTrainSchedule.id,
          timetableId
        );
      }

      dispatch(
        setSuccess({
          title: isPacedTrainMode ? t('pacedTrains.added') : t('trainAdded'),
          text: `${simulationConf.name}: ${simulationConf.startTime.toLocaleTimeString()}`,
        })
      );
      if (simulationConf.editingItemType === 'pacedTrain') {
        dispatch(clearAddedExceptionsList());
      }
      upsertTimetableItems([formattedNewTrainSchedule]);
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
      {isPacedTrainMode ? t('addPacedTrain') : t('addUniqueTrain')}
    </button>
  );
};

export default CreateTimetableItemButton;
