import { Plus } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type { TrainScheduleResponse } from 'common/api/osrdEditoastApi';
import {
  createExceptions,
  createPacedTrains,
} from 'modules/trainSchedule/helpers/updateTrainScheduleHelpers';
import { setFailure, setSuccess } from 'reducers/main';
import { clearAddedExceptionsList } from 'reducers/osrdconf/operationalStudiesConf';
import {
  getOperationalStudiesConf,
  getAddedExceptions,
} from 'reducers/osrdconf/operationalStudiesConf/selectors';
import { updateSelectedTrain } from 'reducers/simulationResults';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';
import { formatEditoastIdToPacedTrainId } from 'utils/trainId';

import { formatTrainSchedulePayload } from './helpers/formatTrainSchedulePayload';
import { validateTrainSchedule } from './helpers/validateTrainSchedule';

type CreateTrainScheduleButtonProps = {
  setIsWorking: (isWorking: boolean) => void;
  upsertTrainSchedules: (trainSchedules: TrainScheduleResponse[]) => void;
  closeManageTrainScheduleAndOpenTableBoard: () => void;
};

/**
 * Create unique trains and paced trains
 */
const CreateTrainScheduleButton = ({
  setIsWorking,
  upsertTrainSchedules,
  closeManageTrainScheduleAndOpenTableBoard,
}: CreateTrainScheduleButtonProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTrainSchedule' });

  const { workerStatus, sandboxId, timetableId } = useScenarioContext();

  const simulationConf = useSelector(getOperationalStudiesConf);
  const addedExceptions = useSelector(getAddedExceptions);

  const isPacedTrainMode = simulationConf.editingTrainType === 'pacedTrain';

  const createTrainSchedules = async () => {
    setIsWorking(true);

    try {
      const newTrainSchedulePayload = formatTrainSchedulePayload(simulationConf);

      const validationErrors = validateTrainSchedule(newTrainSchedulePayload);
      if (validationErrors.length) {
        validationErrors.forEach((errorCode) => {
          dispatch(
            setFailure({
              name: t('errorMessages.trainScheduleTitle'),
              message: t(`errorMessages.${errorCode}`),
            })
          );
        });

        return;
      }

      const formattedNewTrainSchedule: TrainScheduleResponse = (
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
        change_groups: {
          start_time: { value: exStartTime.getTime() },
        },
        disabled: false,
      }));

      if (newAddedExceptions.length > 0) {
        const newExceptions = await createExceptions(
          dispatch,
          newAddedExceptions,
          formattedNewTrainSchedule.id,
          timetableId
        );

        // Add the new exceptions to the train schedule so they contain their new exception ids
        trainScheduleToUpsert = {
          ...formattedNewTrainSchedule,
          ...(formattedNewTrainSchedule.paced && {
            paced: {
              ...formattedNewTrainSchedule.paced,
              exceptions: newExceptions,
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
      if (simulationConf.editingTrainType === 'pacedTrain') {
        dispatch(clearAddedExceptionsList());
      }
      upsertTrainSchedules([trainScheduleToUpsert]);
      closeManageTrainScheduleAndOpenTableBoard();
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
      data-testid="create-train-schedule-button"
    >
      <span className="mr-2">
        <Plus size="lg" />
      </span>
      {isPacedTrainMode ? t('addPacedTrain') : t('addUniqueTrain')}
    </button>
  );
};

export default CreateTrainScheduleButton;
