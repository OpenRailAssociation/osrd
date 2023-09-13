import React from 'react';
import { store } from 'Store';
import { FaPlus } from 'react-icons/fa';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { setFailure, setSuccess } from 'reducers/main';
import { time2sec, sec2time } from 'utils/timeManipulation';
import getSimulationResults from 'applications/operationalStudies/components/Scenario/getSimulationResults';
import formatConf from 'applications/operationalStudies/components/ManageTrainSchedule/helpers/formatConf';
import trainNameWithNum from 'applications/operationalStudies/components/ManageTrainSchedule/helpers/trainNameHelper';
import { TrainScheduleOptions } from 'common/api/osrdMiddlewareApi';
import {
  Allowance,
  Comfort,
  InfraWithState,
  PowerRestrictionRange,
  Infra,
  TrainScheduleBatchItem,
  osrdEditoastApi,
} from 'common/api/osrdEditoastApi';
import { updateReloadTimetable } from 'reducers/osrdsimulation/actions';

type Props = {
  infraState?: InfraWithState['state'];
  setIsWorking: (isWorking: boolean) => void;
};

type error400 = {
  status: 400;
  data: {
    cause: string;
    errorType: string;
    message: string;
    trace: unknown;
    type: string;
  };
};

export default function SubmitConfAddTrainSchedule({ infraState, setIsWorking }: Props) {
  const [postTrainSchedule] =
    osrdEditoastApi.endpoints.postTrainScheduleStandaloneSimulation.useMutation();
  const dispatch = useDispatch();
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const [getTimetableWithTrainSchedulesDetails] =
    osrdEditoastApi.endpoints.getTimetableById.useLazyQuery();

  async function submitConfAddTrainSchedules() {
    const { osrdconf } = store.getState();
    const osrdConfig = formatConf(dispatch, t, osrdconf.simulationConf);

    if (!osrdconf.simulationConf.pathfindingID) {
      dispatch(
        setFailure({
          name: t('errorMessages.error'),
          message: t(`errorMessages.noPathfinding`),
        })
      );
    } else if (
      osrdConfig &&
      osrdconf.simulationConf.pathfindingID &&
      osrdconf.simulationConf.timetableID
    ) {
      setIsWorking(true);
      const departureTime = time2sec(osrdconf.simulationConf.departureTime);
      const schedules: TrainScheduleBatchItem[] = [];
      let actualTrainCount = 1;
      for (let nb = 1; nb <= osrdconf.simulationConf.trainCount; nb += 1) {
        const newDepartureTimeString = sec2time(
          departureTime + 60 * osrdconf.simulationConf.trainDelta * (nb - 1)
        );
        const trainName = trainNameWithNum(
          osrdconf.simulationConf.name,
          actualTrainCount,
          osrdconf.simulationConf.trainCount
        );
        const schedule = formatConf(dispatch, t, {
          ...osrdconf.simulationConf,
          name: trainName,
          departureTime: newDepartureTimeString,
        });
        if (schedule) {
          schedules.push(schedule);
        }
        actualTrainCount += osrdconf.simulationConf.trainStep;
      }

      try {
        await postTrainSchedule({
          body: {
            path: osrdconf.simulationConf.pathfindingID,
            schedules,
            timetable: osrdconf.simulationConf.timetableID,
          },
        }).unwrap();
        dispatch(updateReloadTimetable(true));

        dispatch(
          setSuccess({
            title: t('trainAdded'),
            text: `${osrdconf.simulationConf.name}: ${sec2time(departureTime)}`,
          })
        );
        setIsWorking(false);
        const timetable = await getTimetableWithTrainSchedulesDetails({
          id: osrdconf.simulationConf.timetableID as number,
        }).unwrap();
        dispatch(updateReloadTimetable(false));
        getSimulationResults(timetable);
      } catch (e: unknown) {
        setIsWorking(false);
        if (e instanceof Error) {
          dispatch(
            setFailure({
              name: e.name,
              message: t(`errorMessages.${e.message}`),
            })
          );
        } else {
          const error = { ...(e as error400) };
          dispatch(
            setFailure({
              name: t('errorMessages.error'),
              message: t(`errorMessages.${error.data.errorType}`),
            })
          );
        }
      }
    }
  }

  return (
    <button
      className="btn btn-primary mb-2"
      type="button"
      disabled={infraState !== 'CACHED'}
      onClick={submitConfAddTrainSchedules}
      data-testid="add-train-schedules"
    >
      <span className="mr-2">
        <FaPlus />
      </span>
      {t('addTrainSchedule')}
    </button>
  );
}
