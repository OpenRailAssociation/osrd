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
import {
  getOperationalStudiesConf,
  getAddedExceptions,
} from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type { TimetableItem } from 'reducers/osrdconf/types';
import { updateSelectedTrain } from 'reducers/simulationResults';
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
  upsertTrainSchedules: (trainSchedules: TimetableItem[]) => void;
  isPacedTrainMode: boolean;
};

/**
 * Create unique trains and paced trains
 */
const CreateTimetableItemButton = ({
  setIsWorking,
  upsertTrainSchedules,
  isPacedTrainMode,
}: CreateTimetableItemButtonProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTrainSchedule' });

  const { workerStatus, sandboxId, timetableId } = useScenarioContext();

  const simulationConf = useSelector(getOperationalStudiesConf);
  const addedExceptions = useSelector(getAddedExceptions);

  // TODO TS2 : remove this when rollingStockName will replace rollingStockId in the store
  const { rollingStock } = useStoreDataForRollingStockSelector({
    rollingStockId: simulationConf.rollingStockID,
  });

  const createTrainSchedules = async () => {
    if (!checkCurrentConfig(simulationConf, t, dispatch, rollingStock?.name)) return;

    setIsWorking(true);

    try {
      const newTrainSchedulePayload = isPacedTrainMode
        ? formatPacedTrainPayload(simulationConf, rollingStock!.name)
        : formatTimetableItemPayload(simulationConf, rollingStock!.name);

      const formattedNewTrainSchedule: TimetableItem = (
        await createPacedTrains(dispatch, sandboxId, [newTrainSchedulePayload])
      )[0];
      dispatch(
        updateSelectedTrain({
          id: formatEditoastIdToPacedTrainId(formattedNewTrainSchedule.id),
          by: 'timetable',
        })
      );

      let trainScheduleToUpsert = formattedNewTrainSchedule;

      const newAddedExceptions = addedExceptions.map(({ startTime: exStartTime }) => ({
        key: '', // TODO : remove this when the key will be removed from the model
        start_time: { value: exStartTime.toISOString() },
      }));

      if (newAddedExceptions.length > 0) {
        const newExceptions = await createExceptions(
          dispatch,
          newAddedExceptions,
          formattedNewTrainSchedule.id,
          timetableId
        );

        // TODO : remove this part when the back will be done inserting the new exception format in TrainSchedule
        const formattedExceptions = newExceptions.map((exceptionNewModel) => {
          const {
            change_groups,
            train_schedule_id: _train_schedule_id,
            timetable_id: _timetable_id,
            ...restExceptions
          } = exceptionNewModel;
          return {
            ...change_groups,
            ...restExceptions,
            // TODO_EXCEPTION: remove this when drop key in the model
            key: '',
          };
        });

        // Add the new exceptions to the train schedule so they contain their new exception ids
        trainScheduleToUpsert = {
          ...formattedNewTrainSchedule,
          ...(formattedNewTrainSchedule.paced && {
            paced: {
              ...formattedNewTrainSchedule.paced,
              exceptions: formattedExceptions,
            },
          }),
        };
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
      upsertTrainSchedules([trainScheduleToUpsert]);
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
