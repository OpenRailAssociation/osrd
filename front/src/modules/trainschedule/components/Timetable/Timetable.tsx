import { useMemo, useState, useCallback } from 'react';

import cx from 'classnames';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { Virtualizer } from 'virtua';

import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import type { Conflict, InfraState, TrainScheduleResult } from 'common/api/osrdEditoastApi';
import i18n from 'i18n';
import ConflictsList from 'modules/conflict/components/ConflictsList';
import { updateSelectedTrainId } from 'reducers/simulationResults';
import {
  getSelectedTrainId,
  getTrainIdUsedForProjection,
} from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';

import TimetableToolbar from './TimetableToolbar';
import TimetableTrainCard from './TimetableTrainCard';
import type { TrainScheduleWithDetails } from './types';

type TimetableProps = {
  setDisplayTrainScheduleManagement: (mode: string) => void;
  infraState: InfraState;
  conflicts?: Conflict[];
  upsertTrainSchedules: (trainSchedules: TrainScheduleResult[]) => void;
  setTrainIdToEdit: (trainId?: number) => void;
  removeTrains: (trainIds: number[]) => void;
  trainIdToEdit?: number;
  trainSchedules?: TrainScheduleResult[];
  trainSchedulesWithDetails: TrainScheduleWithDetails[];
  dtoImport: () => void;
};

const formatDepartureDate = (d: Date) => dayjs(d).locale(i18n.language).format('dddd D MMMM YYYY');

const Timetable = ({
  setDisplayTrainScheduleManagement,
  infraState,
  conflicts,
  upsertTrainSchedules,
  removeTrains,
  setTrainIdToEdit,
  trainIdToEdit,
  trainSchedules = [],
  trainSchedulesWithDetails,
  dtoImport,
}: TimetableProps) => {
  const { t } = useTranslation(['operationalStudies/scenario', 'common/itemTypes']);

  const [displayedTrainSchedules, setDisplayedTrainSchedules] = useState<
    TrainScheduleWithDetails[]
  >([]);
  const [conflictsListExpanded, setConflictsListExpanded] = useState(false);
  const [selectedTrainIds, setSelectedTrainIds] = useState<number[]>([]);
  const [showTrainDetails, setShowTrainDetails] = useState(false);
  const selectedTrainId = useSelector(getSelectedTrainId);
  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);
  const dispatch = useAppDispatch();

  const toggleShowTrainDetails = () => {
    setShowTrainDetails(!showTrainDetails);
  };

  const removeAndUnselectTrains = useCallback((trainIds: number[]) => {
    removeTrains(trainIds);
    setSelectedTrainIds([]);
    dtoImport();
  }, []);

  const toggleConflictsListExpanded = () => {
    setConflictsListExpanded(!conflictsListExpanded);
  };

  const handleSelectTrain = useCallback(
    (id: number) => {
      const currentSelectedTrainIds = [...selectedTrainIds];
      const index = currentSelectedTrainIds.indexOf(id);

      if (index === -1) {
        currentSelectedTrainIds.push(id);
      } else {
        currentSelectedTrainIds.splice(index, 1);
      }

      setSelectedTrainIds(currentSelectedTrainIds);
    },
    [selectedTrainIds]
  );

  const handleConflictClick = (conflict: Conflict) => {
    if (conflict.train_schedule_ids.length > 0) {
      const firstTrainId = conflict.train_schedule_ids[0];
      dispatch(updateSelectedTrainId(firstTrainId));
    }
  };

  const currentDepartureDates = useMemo(
    () => displayedTrainSchedules.map((train) => formatDepartureDate(train.startTime)),
    [displayedTrainSchedules]
  );

  const showDepartureDates = useMemo(() => {
    let previousDepartureDate = '';
    return currentDepartureDates.map((date) => {
      const show = date !== previousDepartureDate;
      if (show) previousDepartureDate = date;
      return show;
    });
  }, [currentDepartureDates]);

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
          trainSchedulesWithDetails={trainSchedulesWithDetails}
          displayedTrainSchedules={displayedTrainSchedules}
          setDisplayedTrainSchedules={setDisplayedTrainSchedules}
          selectedTrainIds={selectedTrainIds}
          setSelectedTrainIds={setSelectedTrainIds}
          removeTrains={removeAndUnselectTrains}
          trainSchedules={trainSchedules}
          isInSelection={selectedTrainIds.length > 0}
        />
        <Virtualizer overscan={15}>
          {displayedTrainSchedules.map((train: TrainScheduleWithDetails, index) => (
            <div key={`timetable-train-card-${train.id}`}>
              {showDepartureDates[index] && (
                <div className="scenario-timetable-departure-date">
                  {currentDepartureDates[index]}
                </div>
              )}
              <TimetableTrainCard
                isInSelection={selectedTrainIds.includes(train.id)}
                handleSelectTrain={handleSelectTrain}
                train={train}
                isSelected={infraState === 'CACHED' && selectedTrainId === train.id}
                isModified={train.id === trainIdToEdit}
                setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
                upsertTrainSchedules={upsertTrainSchedules}
                setTrainIdToEdit={setTrainIdToEdit}
                removeTrains={removeAndUnselectTrains}
                projectionPathIsUsed={
                  infraState === 'CACHED' && trainIdUsedForProjection === train.id
                }
                dtoImport={dtoImport}
              />
            </div>
          ))}
        </Virtualizer>
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
