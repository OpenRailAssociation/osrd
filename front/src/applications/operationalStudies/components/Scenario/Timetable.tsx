import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { FaDownload, FaPlus } from 'react-icons/fa';
import cx from 'classnames';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useDebounce } from 'utils/helpers';
import { trainscheduleURI } from 'applications/operationalStudies/components/SimulationResults/simulationResultsConsts';
import {
  updateMustRedraw,
  updateSelectedProjection,
  updateSelectedTrain,
} from 'reducers/osrdsimulation/actions';
import { deleteRequest, get, post } from 'common/requests';
import { setFailure, setSuccess } from 'reducers/main';
import trainNameWithNum from 'applications/operationalStudies/components/ManageTrainSchedule/helpers/trainNameHelper';
import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import { getTimetableID, getTrainScheduleIDsToModify } from 'reducers/osrdconf/selectors';
import { OsrdSimulationState, ScheduledTrain } from 'reducers/osrdsimulation/types';
import { RootState } from 'reducers';
import { Path } from 'types';
import { updateTrainScheduleIDsToModify } from 'reducers/osrdconf';
import { valueToInterval } from 'utils/numbers';
import { GetTimetableByIdApiResponse, Infra, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { durationInSeconds } from 'utils/timeManipulation';
import getTimetable from './getTimetable';
import TimetableTrainCard from './TimetableTrainCard';
import findTrainsDurationsIntervals from '../ManageTrainSchedule/helpers/trainsDurationsIntervals';
import ConflictsList, { Conflict } from './ConflictsList';

type Props = {
  setDisplayTrainScheduleManagement: (mode: string) => void;
  trainsWithDetails: boolean;
  conflicts: Conflict[];
  infraState: Infra['state'];
};

export default function Timetable({
  setDisplayTrainScheduleManagement,
  trainsWithDetails,
  conflicts,
  infraState,
}: Props) {
  const selectedProjection = useSelector(
    (state: RootState) => state.osrdsimulation.selectedProjection
  );
  const selectedTrain = useSelector((state: RootState) => state.osrdsimulation.selectedTrain);
  const timetableID = useSelector(getTimetableID);
  const trainScheduleIDsToModify = useSelector(getTrainScheduleIDsToModify);
  const reloadTimetable = useSelector((state: RootState) => state.osrdsimulation.reloadTimetable);
  const [filter, setFilter] = useState('');
  const [trainsList, setTrainsList] = useState<ScheduledTrain[]>();
  const [trainsDurationsIntervals, setTrainsDurationsIntervals] = useState<number[]>();
  const [conflictsListExpanded, setConflictsListExpanded] = useState(false);
  const [timetable, setTimetable] = useState<GetTimetableByIdApiResponse>();

  const dispatch = useDispatch();
  const { t } = useTranslation(['operationalStudies/scenario']);

  const debouncedTerm = useDebounce(filter, 500) as string;

  const [getTimetableWithTrainSchedulesDetails] = osrdEditoastApi.useLazyGetTimetableByIdQuery();

  const changeSelectedTrain = (idx: number) => {
    dispatch(updateSelectedTrain(idx));
    dispatch(updateMustRedraw(true));
  };

  const deleteTrain = async (train: ScheduledTrain) => {
    try {
      await deleteRequest(`${trainscheduleURI}${train.id}/`);
      const currentTimetable = await getTimetableWithTrainSchedulesDetails({
        id: timetableID as number,
      }).unwrap();
      getTimetable(currentTimetable);
      dispatch(
        setSuccess({
          title: t('timetable.trainDeleted', { name: train.train_name }),
          text: '',
        })
      );
    } catch (e) {
      console.error(e);
      if (e instanceof Error) {
        dispatch(
          setFailure({
            name: e.name,
            message: e.message,
          })
        );
      }
    }
  };

  const duplicateTrain = async (train: ScheduledTrain) => {
    // Static for now, will be dynamic when UI will be ready
    const trainName = `${train.train_name} (${t('timetable.copy')})`;
    const trainDelta = 5;
    const trainCount = 1;
    const trainStep = 5;
    //

    const trainDetail = await get(`${trainscheduleURI}${train.id}/`);

    const params: { timetable: number; path: Path; schedules: ScheduledTrain[] } = {
      timetable: trainDetail.timetable,
      path: trainDetail.path,
      schedules: [],
    };
    let actualTrainCount = 1;
    for (let nb = 1; nb <= trainCount; nb += 1) {
      const newTrainDelta = 60 * trainDelta * nb;
      const newOriginTime = train.departure_time + newTrainDelta;
      const newTrainName = trainNameWithNum(trainName, actualTrainCount, trainCount);
      params.schedules.push({
        ...trainDetail,
        departure_time: newOriginTime,
        train_name: newTrainName,
      });
      actualTrainCount += trainStep;
    }
    try {
      await post(`${trainscheduleURI}standalone_simulation/`, params);
      const currentTimetable = await getTimetableWithTrainSchedulesDetails({
        id: timetableID as number,
      }).unwrap();
      getTimetable(currentTimetable);
      dispatch(
        setSuccess({
          title: t('timetable.trainAdded'),
          text: `${trainName}`,
        })
      );
    } catch (e) {
      console.error(e);
      if (e instanceof Error) {
        dispatch(
          setFailure({
            name: e.name,
            message: e.message,
          })
        );
      }
    }
  };

  const selectPathProjection = async (train: ScheduledTrain) => {
    if (train) {
      dispatch(
        updateSelectedProjection({
          id: train.id,
          path: train.path_id,
        })
      );
    }
  };
  const toggleConflictsListExpanded = () => {
    setConflictsListExpanded(!conflictsListExpanded);
  };

  const isTrainFiltered = (train: ScheduledTrain, debounce?: string): boolean => {
    if (debounce) {
      return (
        !train.train_name.toLowerCase().includes(debouncedTerm.toLowerCase()) &&
        !train.labels.join('').toLowerCase().includes(debouncedTerm.toLowerCase())
      );
    }
    return false;
  };

  const isProjectionPathUsed = (
    infraStateStatus: Infra['state'],
    trainId: number,
    projection?: OsrdSimulationState['selectedProjection']
  ): boolean => {
    if (infraStateStatus !== 'CACHED' && !projection) {
      return false;
    }
    if (infraStateStatus === 'CACHED' && projection) {
      return projection.id === trainId;
    }
    return false;
  };

  useEffect(() => {
    if (timetable && timetable.detailed_train_schedules) {
      const scheduledTrains = timetable.detailed_train_schedules;

      const trainsListWithFilterAndDuration = scheduledTrains.map((train: ScheduledTrain) => ({
        ...train,
        isFiltered: isTrainFiltered(train, debouncedTerm),
        duration: durationInSeconds(train.departure_time, train.arrival_time),
      }));
      setTrainsList(trainsListWithFilterAndDuration);
    }
  }, [trainsDurationsIntervals, debouncedTerm]);

  useEffect(() => {
    if (timetable && timetable.detailed_train_schedules) {
      setTrainsDurationsIntervals(findTrainsDurationsIntervals(timetable.detailed_train_schedules));
    }
  }, [timetable]);

  useEffect(() => {
    if (timetableID && !reloadTimetable) {
      getTimetableWithTrainSchedulesDetails({ id: timetableID })
        .unwrap()
        .then((result) => {
          setTimetable(result);
        });
    }
  }, [timetableID, reloadTimetable]);

  return (
    <div className="scenario-timetable">
      <div className="scenario-timetable-addtrains-buttons">
        <button
          className="btn btn-secondary btn-sm"
          type="button"
          data-testid="scenarios-import-train-schedule-button"
          onClick={() => setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.import)}
        >
          <span className="mr-2">
            <FaDownload />
          </span>
          {t('timetable.importTrainSchedule')}
        </button>
        <button
          className="btn btn-primary btn-sm"
          type="button"
          data-testid="scenarios-add-train-schedule-button"
          onClick={() => {
            setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.add);
            dispatch(updateTrainScheduleIDsToModify(undefined));
          }}
        >
          <span className="mr-2">
            <FaPlus />
          </span>
          {t('timetable.addTrainSchedule')}
        </button>
      </div>
      <div className="scenario-timetable-toolbar">
        <div className="small">
          {t('trainCount', {
            count: trainsList
              ? trainsList.filter((train: ScheduledTrain) => !train.isFiltered).length
              : 0,
          })}
        </div>
        <div className="flex-grow-1">
          <InputSNCF
            type="text"
            id="scenarios-filter"
            name="scenarios-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('filterPlaceholder')}
            whiteBG
            noMargin
            unit={<i className="icons-search" />}
            sm
            data-testid="scenarios-filter"
          />
        </div>
      </div>
      <div
        className={cx(
          'scenario-timetable-trains',
          trainsWithDetails && 'with-details',
          conflictsListExpanded && 'expanded'
        )}
      >
        {trainsList &&
          trainsDurationsIntervals &&
          trainsList.map(
            (train: ScheduledTrain, idx: number) =>
              !train.isFiltered && (
                <TimetableTrainCard
                  train={train}
                  intervalPosition={valueToInterval(train.duration, trainsDurationsIntervals)}
                  key={`timetable-train-card-${train.id}-${train.path_id}`}
                  isSelected={infraState !== 'CACHED' ? false : selectedTrain === idx}
                  isModified={trainScheduleIDsToModify?.includes(train.id)}
                  projectionPathIsUsed={isProjectionPathUsed(
                    infraState,
                    train.id,
                    selectedProjection
                  )}
                  idx={idx}
                  changeSelectedTrain={changeSelectedTrain}
                  deleteTrain={deleteTrain}
                  duplicateTrain={duplicateTrain}
                  selectPathProjection={selectPathProjection}
                  setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
                />
              )
          )}
      </div>
      <ConflictsList
        conflicts={conflicts}
        expanded={conflictsListExpanded}
        toggleConflictsList={toggleConflictsListExpanded}
      />
    </div>
  );
}
