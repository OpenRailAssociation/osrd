import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useItineraryModalContext } from 'applications/operationalStudies/hooks/useItineraryModalContext';
import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import { useTimetableContext } from 'applications/operationalStudies/hooks/useTimetableContext';
import type { TrainScheduleResponse } from 'common/api/osrdEditoastApi';
import {
  createExceptions,
  createTrainSchedules,
} from 'modules/trainSchedule/helpers/updateTrainScheduleHelpers';
import { setFailure, setSuccess } from 'reducers/main';
import { clearAddedExceptionsList } from 'reducers/osrdconf/operationalStudiesConf';
import {
  getAddedExceptions,
  getOperationalStudiesConf,
} from 'reducers/osrdconf/operationalStudiesConf/selectors';
import { updateSelectedTrain } from 'reducers/simulationResults';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';
import { formatEditoastIdToTrainScheduleId } from 'utils/trainId';

import { formatTrainSchedulePayload } from '../helpers/formatTrainSchedulePayload';
import { validateTrainSchedule } from '../helpers/validateTrainSchedule';

export function useCreateTrainSchedule(
  setIsWorking: (isWorking: boolean) => void,
  onTrainCreated: () => void
) {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTrainSchedule' });

  const { sandboxId, timetableId } = useScenarioContext();
  const { upsertTrainSchedules } = useTimetableContext();

  const simulationConf = useSelector(getOperationalStudiesConf);
  const addedExceptions = useSelector(getAddedExceptions);

  const { closeItineraryModal } = useItineraryModalContext();

  const isPacedTrainMode = simulationConf.editingTrainType === 'pacedTrain';

  return async () => {
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
        await createTrainSchedules(dispatch, sandboxId, [newTrainSchedulePayload])
      )[0];
      dispatch(
        updateSelectedTrain({
          id: formatEditoastIdToTrainScheduleId(formattedNewTrainSchedule.id),
          by: 'timetable',
        })
      );

      let trainScheduleToUpsert = formattedNewTrainSchedule;

      const newAddedExceptions = addedExceptions.map(({ startTime: exStartTime }) => ({
        key: '', // TODO : remove this when the key will be removed from the model
        start_time: { value: exStartTime.getTime() },
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
      if (simulationConf.editingTrainType === 'pacedTrain') {
        dispatch(clearAddedExceptionsList());
      }
      upsertTrainSchedules([trainScheduleToUpsert]);

      closeItineraryModal();
      onTrainCreated();
    } catch (e) {
      dispatch(setFailure(castErrorToFailure(e)));
    } finally {
      setIsWorking(false);
    }
  };
}
