import React, { useContext, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { FaDownload, FaPlus, FaTrash } from 'react-icons/fa';
import { BiSelectMultiple } from 'react-icons/bi';
import cx from 'classnames';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useDebounce } from 'utils/helpers';
import { trainscheduleURI } from 'applications/operationalStudies/components/SimulationResults/simulationResultsConsts';
import {
  updateMustRedraw,
  updateReloadTimetable,
  updateSelectedProjection,
  updateSelectedTrainId,
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
import { getSelectedTrainId } from 'reducers/osrdsimulation/selectors';
import { isEmpty } from 'lodash';
import { BsFillExclamationTriangleFill } from 'react-icons/bs';
import DeleteModal from 'common/BootstrapSNCF/ModalSNCF/DeleteModal';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import getTimetable from './getTimetable';
import TimetableTrainCard from './TimetableTrainCard';
import findTrainsDurationsIntervals from '../ManageTrainSchedule/helpers/trainsDurationsIntervals';
import ConflictsList, { Conflict } from './ConflictsList';

type Props = {
  setDisplayTrainScheduleManagement: (mode: string) => void;
  trainsWithDetails: boolean;
  infraState: Infra['state'];
};

export default function Timetable({
  setDisplayTrainScheduleManagement,
  trainsWithDetails,
  infraState,
}: Props) {
  const selectedProjection = useSelector(
    (state: RootState) => state.osrdsimulation.selectedProjection
  );
  const selectedTrainId = useSelector(getSelectedTrainId);
  const timetableID = useSelector(getTimetableID);
  const trainScheduleIDsToModify = useSelector(getTrainScheduleIDsToModify);
  const reloadTimetable = useSelector((state: RootState) => state.osrdsimulation.reloadTimetable);
  const [filter, setFilter] = useState('');
  const [trainsList, setTrainsList] = useState<ScheduledTrain[]>();
  const [trainsDurationsIntervals, setTrainsDurationsIntervals] = useState<number[]>();
  const [conflictsListExpanded, setConflictsListExpanded] = useState(false);
  const [timetable, setTimetable] = useState<GetTimetableByIdApiResponse>();
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [multiselectOn, setMultiselectOn] = useState<boolean>(false);
  const [selectedTrainIds, setSelectedTrainIds] = useState<number[]>([]);
  const { openModal } = useContext(ModalContext);

  const dispatch = useDispatch();
  const { t } = useTranslation(['operationalStudies/scenario', 'common/itemTypes']);

  const debouncedTerm = useDebounce(filter, 500) as string;

  const [deleteTrainSchedules] = osrdEditoastApi.endpoints.deleteTrainSchedule.useMutation();

  const [getTimetableWithTrainSchedulesDetails] = osrdEditoastApi.useLazyGetTimetableByIdQuery();
  const [getTimetableConflicts] = osrdEditoastApi.useLazyGetTimetableByIdConflictsQuery();

  const changeSelectedTrainId = (trainId: number) => {
    dispatch(updateSelectedTrainId(trainId));
    dispatch(updateMustRedraw(true));
  };

  const refreshTimeTable = async () => {
    dispatch(updateReloadTimetable(true));
    const currentTimetable = await getTimetableWithTrainSchedulesDetails({
      id: timetableID as number,
    }).unwrap();
    getTimetable(currentTimetable);
    dispatch(updateReloadTimetable(false));
  };
  const deleteTrain = async (train: ScheduledTrain) => {
    try {
      await deleteRequest(`${trainscheduleURI}${train.id}/`);
      refreshTimeTable();
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
      refreshTimeTable();
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

  const timeTableHasInvalidTrain = (trains: ScheduledTrain[]) =>
    trains.some((train) => train.invalid_reasons && train.invalid_reasons.length > 0);
  const toggleTrainSelection = (id: number) => {
    const currentSelectedTrainIds = [...selectedTrainIds];
    const index = currentSelectedTrainIds.indexOf(id); // Find the index of the ID in the array

    if (index === -1) {
      currentSelectedTrainIds.push(id);
    } else {
      currentSelectedTrainIds.splice(index, 1);
    }

    setSelectedTrainIds(currentSelectedTrainIds);
  };

  const selectAllTrains = () => {
    if (
      trainsList &&
      trainsList.filter((train: ScheduledTrain) => !train.isFiltered).length ===
        selectedTrainIds.length
    ) {
      setSelectedTrainIds([]);
    } else {
      const trainIds: number[] = [];
      trainsList?.map((train) => trainIds.push(train.id));
      setSelectedTrainIds(trainIds);
    }
  };

  const handleTrainsDelete = async () => {
    try {
      const trainsCount = selectedTrainIds.length;
      await deleteTrainSchedules({ body: { ids: selectedTrainIds } });
      refreshTimeTable();
      setMultiselectOn(false);
      dispatch(
        setSuccess({
          title: t('timetable.trainsSelectionDeleted', { count: trainsCount }),
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

  useEffect(() => {
    if (!multiselectOn) setSelectedTrainIds([]);
  }, [multiselectOn]);

  useEffect(() => {
    if (timetable && timetable.train_schedule_summaries) {
      const scheduledTrains = timetable.train_schedule_summaries;

      const trainsListWithFilterAndDuration = scheduledTrains.map((train: ScheduledTrain) => ({
        ...train,
        isFiltered: isTrainFiltered(train, debouncedTerm),
        duration: durationInSeconds(train.departure_time, train.arrival_time),
      }));
      setTrainsList(trainsListWithFilterAndDuration);
    }
  }, [trainsDurationsIntervals, debouncedTerm]);

  useEffect(() => {
    if (infraState === 'CACHED' && timetableID) {
      getTimetableWithTrainSchedulesDetails({ id: timetableID })
        .unwrap()
        .then((timetableWithTrainSchedules) => {
          setTimetable(timetableWithTrainSchedules);
          setTrainsDurationsIntervals(
            findTrainsDurationsIntervals(timetableWithTrainSchedules.train_schedule_summaries)
          );
          if (!isEmpty(timetableWithTrainSchedules.train_schedule_summaries)) {
            // TODO: rename getTimetable by getSimulationResults
            getTimetable(timetableWithTrainSchedules);
          }
        });
    }
  }, [infraState]);

  useEffect(() => {
    if (timetableID && !reloadTimetable) {
      getTimetableWithTrainSchedulesDetails({ id: timetableID })
        .unwrap()
        .then((result) => {
          setTimetable(result);
          if (result.train_schedule_summaries) {
            setTrainsDurationsIntervals(
              findTrainsDurationsIntervals(result.train_schedule_summaries)
            );
          }
        });

      getTimetableConflicts({ id: timetableID })
        .unwrap()
        .then((data) => {
          setConflicts(data as Conflict[]);
        });
    }
  }, [reloadTimetable]);

  // Avoid keeping this on refresh
  useEffect(() => {
    dispatch(updateTrainScheduleIDsToModify());
  }, []);

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
        {multiselectOn && (
          <input
            type="checkbox"
            className="mr-2"
            checked={
              trainsList &&
              selectedTrainIds.length ===
                trainsList.filter((train: ScheduledTrain) => !train.isFiltered).length
            }
            onChange={() => selectAllTrains()}
          />
        )}
        <div className="small">
          {multiselectOn && <span>{selectedTrainIds.length} / </span>}
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
        <button
          type="button"
          className={cx('multiselect-toggle', multiselectOn ? 'on' : '')}
          onClick={() => setMultiselectOn(!multiselectOn)}
        >
          <BiSelectMultiple />
        </button>
        {multiselectOn && (
          <button
            disabled={!selectedTrainIds.length}
            className={cx('multiselect-delete', !selectedTrainIds.length && 'disabled')}
            type="button"
            onClick={() =>
              openModal(
                <DeleteModal
                  handleDelete={handleTrainsDelete}
                  items={t('common/itemTypes:trains', { count: selectedTrainIds.length })}
                />,
                'sm'
              )
            }
          >
            <FaTrash />
          </button>
        )}
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
          trainsList
            .sort((trainA, trainB) => trainA.departure_time - trainB.departure_time)
            .map(
              (train: ScheduledTrain, idx: number) =>
                !train.isFiltered && (
                  <TimetableTrainCard
                    isSelectable={multiselectOn}
                    isInSelection={selectedTrainIds.includes(train.id)}
                    toggleTrainSelection={toggleTrainSelection}
                    train={train}
                    intervalPosition={valueToInterval(train.duration, trainsDurationsIntervals)}
                    key={`timetable-train-card-${train.id}-${train.path_id}`}
                    isSelected={infraState !== 'CACHED' ? false : selectedTrainId === train.id}
                    isModified={trainScheduleIDsToModify?.includes(train.id)}
                    projectionPathIsUsed={isProjectionPathUsed(
                      infraState,
                      train.id,
                      selectedProjection
                    )}
                    idx={idx}
                    changeSelectedTrainId={changeSelectedTrainId}
                    deleteTrain={deleteTrain}
                    duplicateTrain={duplicateTrain}
                    selectPathProjection={selectPathProjection}
                    setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
                  />
                )
            )}
      </div>
      <div className="scenario-timetable-warnings">
        {trainsList && timeTableHasInvalidTrain(trainsList) && (
          <div className="invalid-trains">
            <BsFillExclamationTriangleFill size="1.5em" />
            <span className="flex-grow-1">{t('timetable.invalidTrains')}</span>
          </div>
        )}
        <ConflictsList
          conflicts={conflicts}
          expanded={conflictsListExpanded}
          toggleConflictsList={toggleConflictsListExpanded}
        />
      </div>
    </div>
  );
}
