import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { FaDownload, FaPlus, FaTrash } from 'react-icons/fa';
import { BiSelectMultiple } from 'react-icons/bi';
import cx from 'classnames';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useDebounce } from 'utils/helpers';
import { updateSelectedProjection, updateSelectedTrainId } from 'reducers/osrdsimulation/actions';
import { setFailure, setSuccess } from 'reducers/main';
import trainNameWithNum from 'modules/trainschedule/components/ManageTrainSchedule/helpers/trainNameHelper';
import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import { getTimetableID, getTrainScheduleIDsToModify } from 'reducers/osrdconf/selectors';
import { OsrdSimulationState, ScheduledTrain } from 'reducers/osrdsimulation/types';
import { updateTrainScheduleIDsToModify } from 'reducers/osrdconf';
import { valueToInterval } from 'utils/numbers';
import { Infra, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { durationInSeconds } from 'utils/timeManipulation';
import {
  getReloadTimetable,
  getSelectedProjection,
  getSelectedTrainId,
} from 'reducers/osrdsimulation/selectors';
import { isEmpty } from 'lodash';
import { BsFillExclamationTriangleFill } from 'react-icons/bs';
import DeleteModal from 'common/BootstrapSNCF/ModalSNCF/DeleteModal';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import ConflictsList from 'modules/conflict/components/ConflictsList';
import findTrainsDurationsIntervals from 'modules/trainschedule/components/ManageTrainSchedule/helpers/trainsDurationsIntervals';
import getSimulationResults from 'applications/operationalStudies/components/Scenario/getSimulationResults';
import TimetableTrainCard from './TimetableTrainCard';

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
  const selectedProjection = useSelector(getSelectedProjection);
  const selectedTrainId = useSelector(getSelectedTrainId);
  const timetableID = useSelector(getTimetableID);
  const trainScheduleIDsToModify = useSelector(getTrainScheduleIDsToModify);
  const reloadTimetable = useSelector(getReloadTimetable);

  const [filter, setFilter] = useState('');
  const [conflictsListExpanded, setConflictsListExpanded] = useState(false);
  const [multiselectOn, setMultiselectOn] = useState<boolean>(false);
  const [selectedTrainIds, setSelectedTrainIds] = useState<number[]>([]);
  const { openModal } = useContext(ModalContext);

  const dispatch = useDispatch();
  const { t } = useTranslation(['operationalStudies/scenario', 'common/itemTypes']);

  const debouncedTerm = useDebounce(filter, 500) as string;

  const [postTrainSchedule] =
    osrdEditoastApi.endpoints.postTrainScheduleStandaloneSimulation.useMutation();
  const [getTrainScheduleById] = osrdEditoastApi.endpoints.getTrainScheduleById.useLazyQuery();
  const [deleteTrainScheduleById] = osrdEditoastApi.endpoints.deleteTrainScheduleById.useMutation();
  const [deleteTrainSchedules] = osrdEditoastApi.endpoints.deleteTrainSchedule.useMutation();

  const {
    data: timetable,
    refetch: refetchTimetable,
    isUninitialized: isTimetableUnintialized,
  } = osrdEditoastApi.endpoints.getTimetableById.useQuery(
    { id: timetableID as number },
    { skip: !timetableID || infraState !== 'CACHED' }
  );

  const { data: conflicts = [], refetch: refetchConflicts } =
    osrdEditoastApi.endpoints.getTimetableByIdConflicts.useQuery(
      { id: timetableID as number },
      { skip: !timetableID }
    );

  useEffect(() => {
    if (timetable) {
      getSimulationResults(timetable, selectedTrainId);
      refetchConflicts();
    }
  }, [timetable]);

  const trainsDurationsIntervals = useMemo(
    () =>
      timetable?.train_schedule_summaries
        ? findTrainsDurationsIntervals(timetable.train_schedule_summaries)
        : [],
    [timetable]
  );

  const isTrainFiltered = (train: ScheduledTrain, debounce?: string): boolean => {
    if (debounce) {
      return (
        !train.train_name.toLowerCase().includes(debouncedTerm.toLowerCase()) &&
        !train.labels.join('').toLowerCase().includes(debouncedTerm.toLowerCase())
      );
    }
    return false;
  };

  const trainsList = useMemo(() => {
    if (timetable) {
      return timetable.train_schedule_summaries.map((train) => ({
        ...train,
        isFiltered: isTrainFiltered(train, debouncedTerm),
        duration: durationInSeconds(train.departure_time, train.arrival_time),
      }));
    }
    return [];
  }, [timetable, trainsDurationsIntervals, debouncedTerm]);

  const changeSelectedTrainId = (trainId: number) => {
    dispatch(updateSelectedTrainId(trainId));
  };

  const deleteSingleTrain = async (train: ScheduledTrain) => {
    deleteTrainScheduleById({ id: train.id })
      .unwrap()
      .then(() => {
        refetchTimetable();
        setMultiselectOn(false);
        dispatch(
          setSuccess({
            title: t('timetable.trainDeleted', { name: train.train_name }),
            text: '',
          })
        );
      })
      .catch((e: unknown) => {
        console.error(e);
        if (e instanceof Error) {
          dispatch(
            setFailure({
              name: e.name,
              message: e.message,
            })
          );
        }
      });
  };

  const duplicateTrain = async (train: ScheduledTrain) => {
    // Static for now, will be dynamic when UI will be ready
    const trainName = `${train.train_name} (${t('timetable.copy')})`;
    const trainDelta = 5;
    const trainCount = 1;
    const actualTrainCount = 1;

    const trainDetail = await getTrainScheduleById({ id: train.id })
      .unwrap()
      .catch((e: unknown) => {
        if (e instanceof Error) {
          dispatch(
            setFailure({
              name: e.name,
              message: e.message,
            })
          );
        }
      });

    if (trainDetail) {
      const newTrain = {
        ...trainDetail,
        rolling_stock: trainDetail.rolling_stock_id,
        timetable: trainDetail.timetable_id,
        departure_time: train.departure_time + 60 * trainDelta,
        train_name: trainNameWithNum(trainName, actualTrainCount, trainCount),
      };
      await postTrainSchedule({
        body: {
          timetable: trainDetail.timetable_id,
          path: trainDetail.path_id,
          schedules: [newTrain],
        },
      })
        .unwrap()
        .then(() => {
          refetchTimetable();
          dispatch(
            setSuccess({
              title: t('timetable.trainAdded'),
              text: `${trainName}`,
            })
          );
        })
        .catch((e: unknown) => {
          console.error(e);
          const error =
            e instanceof Error
              ? {
                  name: e.name,
                  message: e.message,
                }
              : {
                  name: t('errorMessages.error'),
                  message: t('errorMessages.unableToDuplicateATrain'),
                };
          dispatch(setFailure(error));
        });
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
      trainsList.filter((train: ScheduledTrain) => !train.isFiltered).length ===
      selectedTrainIds.length
    ) {
      setSelectedTrainIds([]);
    } else {
      const trainIds =
        trainsList.filter((train: ScheduledTrain) => !train.isFiltered).map((train) => train.id) ||
        [];
      setSelectedTrainIds(trainIds);
    }
  };

  const handleTrainsDelete = async () => {
    const trainsCount = selectedTrainIds.length;
    await deleteTrainSchedules({ body: { ids: selectedTrainIds } })
      .unwrap()
      .then(() => {
        refetchTimetable();
        setMultiselectOn(false);
        dispatch(
          setSuccess({
            title: t('timetable.trainsSelectionDeletedCount', { count: trainsCount }),
            text: '',
          })
        );
      })
      .catch((e) => {
        console.error(e);
        if (e instanceof Error) {
          dispatch(
            setFailure({
              name: e.name,
              message: e.message,
            })
          );
        }
      });
  };

  useEffect(() => {
    if (!multiselectOn) setSelectedTrainIds([]);
  }, [multiselectOn]);

  useEffect(() => {
    if (timetableID && !reloadTimetable && !isTimetableUnintialized) {
      refetchTimetable();
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
              selectedTrainIds.length ===
              trainsList.filter((train: ScheduledTrain) => !train.isFiltered).length
            }
            onChange={() => selectAllTrains()}
          />
        )}
        <div className="small">
          {multiselectOn && <span>{selectedTrainIds.length} / </span>}
          {t('trainCount', {
            count: trainsList.filter((train: ScheduledTrain) => !train.isFiltered).length,
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
        {!isEmpty(trainsList) && (
          <button
            type="button"
            className={cx('multiselect-toggle', multiselectOn ? 'on' : '')}
            onClick={() => setMultiselectOn(!multiselectOn)}
          >
            <BiSelectMultiple />
          </button>
        )}

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
        {trainsDurationsIntervals &&
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
                    deleteTrain={deleteSingleTrain}
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
