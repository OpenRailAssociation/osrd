import React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { FaPlus } from 'react-icons/fa';

import { time2sec, sec2time } from 'utils/timeManipulation';

import formatConf from 'modules/trainschedule/components/ManageTrainSchedule/helpers/formatConf';
import trainNameWithNum from 'modules/trainschedule/components/ManageTrainSchedule/helpers/trainNameHelper';

import { useOsrdConfSelectors } from 'common/osrdContext';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { Infra, TrainScheduleBatchItem } from 'common/api/osrdEditoastApi';

import { setFailure, setSuccess } from 'reducers/main';

type SubmitConfAddTrainScheduleProps = {
  infraState?: Infra['state'];
  refetchTimetable: () => void;
  refetchConflicts: () => void;
  setIsWorking: (isWorking: boolean) => void;
  setTrainResultsToFetch: (trainScheduleIds?: number[]) => void;
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

export default function SubmitConfAddTrainSchedule({
  infraState,
  refetchTimetable,
  refetchConflicts,
  setIsWorking,
  setTrainResultsToFetch,
}: SubmitConfAddTrainScheduleProps) {
  const [postTrainSchedule] =
    osrdEditoastApi.endpoints.postTrainScheduleStandaloneSimulation.useMutation();
  const dispatch = useDispatch();
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);

  const { getConf } = useOsrdConfSelectors();
  const simulationConf = useSelector(getConf);
  const {
    pathfindingID,
    timetableID,
    departureTime,
    trainCount,
    trainDelta,
    trainStep,
    name: confName,
  } = simulationConf;

  async function submitConfAddTrainSchedules() {
    const osrdConfig = formatConf(dispatch, t, simulationConf);

    if (!pathfindingID) {
      dispatch(
        setFailure({
          name: t('errorMessages.error'),
          message: t(`errorMessages.noPathfinding`),
        })
      );
    } else if (osrdConfig && timetableID) {
      setIsWorking(true);
      const formattedDepartureTime = time2sec(departureTime);
      const schedules: TrainScheduleBatchItem[] = [];
      let actualTrainCount = 1;
      for (let nb = 1; nb <= trainCount; nb += 1) {
        const newDepartureTimeString = sec2time(
          formattedDepartureTime + 60 * trainDelta * (nb - 1)
        );
        const trainName = trainNameWithNum(confName, actualTrainCount, trainCount);
        const schedule = formatConf(dispatch, t, {
          ...simulationConf,
          name: trainName,
          departureTime: newDepartureTimeString,
        });
        if (schedule) {
          schedules.push(schedule);
        }
        actualTrainCount += trainStep;
      }

      try {
        const newTrainIds = await postTrainSchedule({
          body: {
            path: pathfindingID,
            schedules,
            timetable: timetableID,
          },
        }).unwrap();

        dispatch(
          setSuccess({
            title: t('trainAdded'),
            text: `${confName}: ${sec2time(formattedDepartureTime)}`,
          })
        );
        setIsWorking(false);
        setTrainResultsToFetch(newTrainIds);
        refetchTimetable();
        refetchConflicts();
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
