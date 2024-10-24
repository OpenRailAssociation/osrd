import { useEffect, useMemo, useState } from 'react';

import cx from 'classnames';
import { compact } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import type { Conflict, InfraState, TrainScheduleResult } from 'common/api/osrdEditoastApi';
import ConflictsList from 'modules/conflict/components/ConflictsList';
import { updateSelectedTrainId } from 'reducers/simulationResults';
import { getTrainIdUsedForProjection } from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import { formatDepartureDate, sortTrainSchedulesByStartTime } from 'utils/date';
import { distributedIntervalsFromArrayOfValues } from 'utils/numbers';

import TimetableDepartureDate from './TimetableDepartureDate';
import TimetableToolbar from './TimetableToolbar';
import TimetableTrainCard from './TimetableTrainCard';
import type { TrainScheduleWithDetails } from './types';

type TimetableProps = {
  setDisplayTrainScheduleManagement: (mode: string) => void;
  infraState: InfraState;
  selectedTrainId?: number;
  conflicts?: Conflict[];
  upsertTrainSchedules: (trainSchedules: TrainScheduleResult[]) => void;
  setTrainIdToEdit: (trainId?: number) => void;
  removeTrains: (trainIds: number[]) => void;
  trainIdToEdit?: number;
  trainSchedules?: TrainScheduleResult[];
  trainSchedulesWithDetails: TrainScheduleWithDetails[];
};

const Timetable = ({
  setDisplayTrainScheduleManagement,
  infraState,
  selectedTrainId,
  conflicts,
  upsertTrainSchedules,
  removeTrains,
  setTrainIdToEdit,
  trainIdToEdit,
  trainSchedules = [],
  trainSchedulesWithDetails,
}: TimetableProps) => {
  const { t } = useTranslation(['operationalStudies/scenario', 'common/itemTypes']);

  const [displayedTrainSchedules, setDisplayedTrainSchedules] = useState<
    TrainScheduleWithDetails[]
  >([]);
  const [conflictsListExpanded, setConflictsListExpanded] = useState(false);
  const [selectedTrainIds, setSelectedTrainIds] = useState<number[]>([]);
  const [showTrainDetails, setShowTrainDetails] = useState(false);
  const [lastDepartureDate, setLastDepartureDate] = useState<string | null>(null);
  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);
  const dispatch = useAppDispatch();

  const trainsDurationsIntervals = useMemo(
    () =>
      displayedTrainSchedules.length > 0
        ? distributedIntervalsFromArrayOfValues(
            compact(displayedTrainSchedules.map((train) => train.duration))
          )
        : [],
    [displayedTrainSchedules]
  );

  const toggleShowTrainDetails = () => {
    setShowTrainDetails(!showTrainDetails);
  };

  const removeAndUnselectTrains = (trainIds: number[]) => {
    removeTrains(trainIds);
    setSelectedTrainIds([]);
  };

  const toggleConflictsListExpanded = () => {
    setConflictsListExpanded(!conflictsListExpanded);
  };

  const handleSelectTrain = (id: number) => {
    const currentSelectedTrainIds = [...selectedTrainIds];
    const index = currentSelectedTrainIds.indexOf(id);

    if (index === -1) {
      currentSelectedTrainIds.push(id);
    } else {
      currentSelectedTrainIds.splice(index, 1);
    }

    setSelectedTrainIds(currentSelectedTrainIds);
  };

  const handleConflictClick = (conflict: Conflict) => {
    if (conflict.train_ids.length > 0) {
      const firstTrainId = conflict.train_ids[0];
      dispatch(updateSelectedTrainId(firstTrainId));
    }
  };

  useEffect(() => {
    const currentDepartureDates = displayedTrainSchedules.map((train) =>
      formatDepartureDate(train.startTime)
    );
    const uniqueDepartureDate = currentDepartureDates[0] || null;
    if (lastDepartureDate !== uniqueDepartureDate) {
      setLastDepartureDate(uniqueDepartureDate);
    }
  }, [lastDepartureDate]);

  return (
    <div className="scenario-timetable">
      <div className="scenario-timetable-addtrains-buttons">
        <button
          type="button"
          data-testid="scenarios-add-train-schedule-button"
          onClick={() => {
            setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.add);
          }}
        >
          {t('timetable.addTrainSchedule')}
        </button>
        <button
          type="button"
          data-testid="scenarios-import-train-schedule-button"
          onClick={() => setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.import)}
        >
          {t('timetable.importTrainSchedule')}
        </button>
      </div>
      <div
        className={cx('scenario-timetable-trains', {
          expanded: conflictsListExpanded,
          'with-details': showTrainDetails,
        })}
      >
        <TimetableToolbar
          showTrainDetails={showTrainDetails}
          toggleShowTrainDetails={toggleShowTrainDetails}
          trainSchedulesWithDetails={sortTrainSchedulesByStartTime(trainSchedulesWithDetails)}
          displayedTrainSchedules={displayedTrainSchedules}
          setDisplayedTrainSchedules={setDisplayedTrainSchedules}
          selectedTrainIds={selectedTrainIds}
          setSelectedTrainIds={setSelectedTrainIds}
          removeTrains={removeAndUnselectTrains}
          trainSchedules={trainSchedules}
          isInSelection={selectedTrainIds.length > 0}
        />
        {trainsDurationsIntervals &&
          displayedTrainSchedules.map((train: TrainScheduleWithDetails) => {
            const currentDepartureDate = formatDepartureDate(train.startTime);
            const showDepartureDate = lastDepartureDate !== currentDepartureDate;
            return (
              <>
                {showDepartureDate && (
                  <TimetableDepartureDate departureDate={currentDepartureDate} />
                )}
                <TimetableTrainCard
                  isInSelection={selectedTrainIds.includes(train.id)}
                  handleSelectTrain={handleSelectTrain}
                  train={train}
                  key={`timetable-train-card-${train.id}-${train.trainName}`}
                  isSelected={infraState === 'CACHED' && selectedTrainId === train.id}
                  isModified={train.id === trainIdToEdit}
                  setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
                  upsertTrainSchedules={upsertTrainSchedules}
                  setTrainIdToEdit={setTrainIdToEdit}
                  removeTrains={removeAndUnselectTrains}
                  projectionPathIsUsed={
                    infraState === 'CACHED' && trainIdUsedForProjection === train.id
                  }
                />
              </>
            );
          })}
        <div
          className={cx('bottom-timetables-trains', {
            'empty-list': trainSchedulesWithDetails.length === 0,
          })}
        />
      </div>
      {conflicts && (
        <ConflictsList
          conflicts={conflicts}
          expanded={conflictsListExpanded}
          toggleConflictsList={toggleConflictsListExpanded}
          trainSchedulesDetails={displayedTrainSchedules}
          onConflictClick={handleConflictClick}
        />
      )}
    </div>
  );
};

export default Timetable;
