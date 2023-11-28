import cx from 'classnames';
import { isEmpty } from 'lodash';
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { BsFillExclamationTriangleFill } from 'react-icons/bs';
import { useTranslation } from 'react-i18next';
import { GoTrash } from 'react-icons/go';
import { FaDownload, FaPlus } from 'react-icons/fa';
import { BiSelectMultiple } from 'react-icons/bi';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useDebounce } from 'utils/helpers';
import { setFailure, setSuccess } from 'reducers/main';
import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import { getTrainScheduleIDsToModify } from 'reducers/osrdconf/selectors';
import { ScheduledTrain } from 'reducers/osrdsimulation/types';
import { updateTrainScheduleIDsToModify } from 'reducers/osrdconf';
import { valueToInterval } from 'utils/numbers';
import {
  Conflict,
  Infra,
  TimetableWithSchedulesDetails,
  osrdEditoastApi,
} from 'common/api/osrdEditoastApi';
import { durationInSeconds } from 'utils/timeManipulation';
import { getSelectedProjection } from 'reducers/osrdsimulation/selectors';
import DeleteModal from 'common/BootstrapSNCF/ModalSNCF/DeleteModal';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import ConflictsList from 'modules/conflict/components/ConflictsList';
import findTrainsDurationsIntervals from 'modules/trainschedule/components/ManageTrainSchedule/helpers/trainsDurationsIntervals';
import { updateSelectedTrainId } from 'reducers/osrdsimulation/actions';
import TimetableTrainCard from './TimetableTrainCard';

type Props = {
  setDisplayTrainScheduleManagement: (mode: string) => void;
  trainsWithDetails: boolean;
  infraState: Infra['state'];
  timetable: TimetableWithSchedulesDetails | undefined;
  selectedTrainId?: number;
  refetchTimetable: () => void;
  conflicts?: Conflict[];
};

export default function Timetable({
  setDisplayTrainScheduleManagement,
  trainsWithDetails,
  infraState,
  timetable,
  selectedTrainId,
  refetchTimetable,
  conflicts,
}: Props) {
  const selectedProjection = useSelector(getSelectedProjection);
  const trainScheduleIDsToModify = useSelector(getTrainScheduleIDsToModify);

  const [filter, setFilter] = useState('');
  const [conflictsListExpanded, setConflictsListExpanded] = useState(false);
  const [multiselectOn, setMultiselectOn] = useState(false);
  const [selectedTrainIds, setSelectedTrainIds] = useState<number[]>([]);
  const { openModal } = useContext(ModalContext);

  const dispatch = useDispatch();
  const { t } = useTranslation(['operationalStudies/scenario', 'common/itemTypes']);

  const debouncedTerm = useDebounce(filter, 500) as string;

  const [deleteTrainSchedules] = osrdEditoastApi.endpoints.deleteTrainSchedule.useMutation();

  useEffect(() => {
    setMultiselectOn(false);
  }, [timetable, infraState]);

  const trainsDurationsIntervals = useMemo(
    () =>
      timetable?.train_schedule_summaries
        ? findTrainsDurationsIntervals(timetable.train_schedule_summaries)
        : [],
    [timetable]
  );

  const keepTrain = (train: ScheduledTrain, searchString: string): boolean => {
    if (searchString) {
      const searchStringInName = train.train_name
        .toLowerCase()
        .includes(searchString.toLowerCase());
      const searchStringInTags = train.labels
        .join('')
        .toLowerCase()
        .includes(searchString.toLowerCase());
      return searchStringInName || searchStringInTags;
    }
    return true;
  };

  const trainsList = useMemo(() => {
    if (timetable) {
      return timetable.train_schedule_summaries
        .filter((train) => keepTrain(train, debouncedTerm))
        .map((train) => ({
          ...train,
          duration: durationInSeconds(train.departure_time, train.arrival_time),
        }));
    }
    return [];
  }, [timetable, trainsDurationsIntervals, debouncedTerm]);

  const toggleConflictsListExpanded = () => {
    setConflictsListExpanded(!conflictsListExpanded);
  };

  const timetableHasInvalidTrain = (trains: ScheduledTrain[]) =>
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
    if (trainsList.length === selectedTrainIds.length) {
      setSelectedTrainIds([]);
    } else {
      const trainIds = trainsList.map((train) => train.id);
      setSelectedTrainIds(trainIds);
    }
  };

  const handleTrainsDelete = async () => {
    const trainsCount = selectedTrainIds.length;

    if (selectedTrainId && selectedTrainIds.includes(selectedTrainId)) {
      // we need to set selectedTrainId to undefined, otherwise just after the delete,
      // some unvalid rtk calls are dispatched (see rollingstock request in SimulationResults)
      dispatch(updateSelectedTrainId(undefined));
    }

    await deleteTrainSchedules({ body: { ids: selectedTrainIds } })
      .unwrap()
      .then(() => {
        dispatch(
          setSuccess({
            title: t('timetable.trainsSelectionDeletedCount', { count: trainsCount }),
            text: '',
          })
        );
      })
      .catch((e: unknown) => {
        console.error(e);
        if (selectedTrainId && selectedTrainIds.includes(selectedTrainId)) {
          dispatch(updateSelectedTrainId(selectedTrainId));
        }
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

  // Avoid keeping this on refresh
  useEffect(() => {
    dispatch(updateTrainScheduleIDsToModify([]));
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
            dispatch(updateTrainScheduleIDsToModify([]));
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
            checked={selectedTrainIds.length === trainsList.length}
            onChange={() => selectAllTrains()}
          />
        )}
        <div className="small">
          {multiselectOn && <span>{selectedTrainIds.length} / </span>}
          {t('trainCount', {
            count: trainsList.length,
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
            className={cx('multiselect-toggle', { on: multiselectOn })}
            onClick={() => setMultiselectOn(!multiselectOn)}
          >
            <BiSelectMultiple />
          </button>
        )}

        {multiselectOn && (
          <button
            disabled={!selectedTrainIds.length}
            className={cx('multiselect-delete', { disabled: !selectedTrainIds.length })}
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
            <GoTrash />
          </button>
        )}
      </div>

      <div
        className={cx('scenario-timetable-trains', {
          expanded: conflictsListExpanded,
          'with-details': trainsWithDetails,
        })}
      >
        {trainsDurationsIntervals &&
          trainsList
            .sort((trainA, trainB) => trainA.departure_time - trainB.departure_time)
            .map((train: ScheduledTrain, idx: number) => (
              <TimetableTrainCard
                idx={idx}
                isSelectable={multiselectOn}
                isInSelection={selectedTrainIds.includes(train.id)}
                toggleTrainSelection={toggleTrainSelection}
                train={train}
                intervalPosition={valueToInterval(train.duration, trainsDurationsIntervals)}
                key={`timetable-train-card-${train.id}-${train.path_id}`}
                isSelected={infraState === 'CACHED' && selectedTrainId === train.id}
                isModified={trainScheduleIDsToModify.includes(train.id)}
                projectionPathIsUsed={
                  infraState === 'CACHED' &&
                  !!selectedProjection &&
                  selectedProjection.id === train.id
                }
                refetchTimetable={refetchTimetable}
                setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
              />
            ))}
      </div>
      <div className="scenario-timetable-warnings">
        {timetableHasInvalidTrain(trainsList) && (
          <div className="invalid-trains">
            <BsFillExclamationTriangleFill size="1.5em" />
            <span className="flex-grow-1">{t('timetable.invalidTrains')}</span>
          </div>
        )}
        {conflicts && (
          <ConflictsList
            conflicts={conflicts}
            expanded={conflictsListExpanded}
            toggleConflictsList={toggleConflictsListExpanded}
          />
        )}
      </div>
    </div>
  );
}
