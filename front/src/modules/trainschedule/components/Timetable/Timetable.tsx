import { useEffect, useMemo, useState } from 'react';

import { Alert, Download, Plus } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { compact } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import type { Conflict, InfraState, TrainScheduleResult } from 'common/api/osrdEditoastApi';
import ConflictsList from 'modules/conflict/components/ConflictsList';
import { updateSelectedTrainId } from 'reducers/osrdsimulation';
import { getTrainIdUsedForProjection } from 'reducers/osrdsimulation/selectors';
import { useAppDispatch } from 'store';
import { distributedIntervalsFromArrayOfValues, valueToInterval } from 'utils/numbers';

import TimetableToolbar from './TimetableToolbar';
import TimetableTrainCard from './TimetableTrainCard';
import type { TrainScheduleWithDetails } from './types';
import { timetableHasInvalidTrain } from './utils';

type TimetableProps = {
  setDisplayTrainScheduleManagement: (mode: string) => void;
  trainsWithDetails: boolean;
  infraState: InfraState;
  trainIds: number[];
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
  trainsWithDetails,
  infraState,
  trainIds,
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

  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);

  const [displayedTrainSchedules, setDisplayedTrainSchedules] = useState<
    TrainScheduleWithDetails[]
  >([]);
  const [conflictsListExpanded, setConflictsListExpanded] = useState(false);
  const [multiselectOn, setMultiselectOn] = useState(false);
  const [selectedTrainIds, setSelectedTrainIds] = useState<number[]>([]);

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

  useEffect(() => {
    setMultiselectOn(false);
  }, [trainIds, infraState]);

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
    if (!multiselectOn) setSelectedTrainIds([]);
  }, [multiselectOn]);

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
            <Download />
          </span>
          {t('timetable.importTrainSchedule')}
        </button>
        <button
          className="btn btn-primary btn-sm"
          type="button"
          data-testid="scenarios-add-train-schedule-button"
          onClick={() => {
            setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.add);
          }}
        >
          <span className="mr-2">
            <Plus />
          </span>
          {t('timetable.addTrainSchedule')}
        </button>
      </div>
      <TimetableToolbar
        trainSchedulesWithDetails={trainSchedulesWithDetails}
        displayedTrainSchedules={displayedTrainSchedules}
        setDisplayedTrainSchedules={setDisplayedTrainSchedules}
        selectedTrainIds={selectedTrainIds}
        setSelectedTrainIds={setSelectedTrainIds}
        multiSelectOn={multiselectOn}
        setMultiSelectOn={setMultiselectOn}
        removeTrains={removeTrains}
        trainSchedules={trainSchedules}
      />

      <div
        className={cx('scenario-timetable-trains', {
          expanded: conflictsListExpanded,
          'with-details': trainsWithDetails,
        })}
      >
        {trainsDurationsIntervals &&
          displayedTrainSchedules.map((train: TrainScheduleWithDetails, idx: number) => (
            <TimetableTrainCard
              idx={idx}
              isSelectable={multiselectOn}
              isInSelection={selectedTrainIds.includes(train.id)}
              handleSelectTrain={handleSelectTrain}
              train={train}
              intervalPosition={valueToInterval(train.duration, trainsDurationsIntervals)}
              key={`timetable-train-card-${train.id}-${train.trainName}`}
              isSelected={infraState === 'CACHED' && selectedTrainId === train.id}
              isModified={train.id === trainIdToEdit}
              projectionPathIsUsed={
                infraState === 'CACHED' && trainIdUsedForProjection === train.id
              }
              setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
              upsertTrainSchedules={upsertTrainSchedules}
              setTrainIdToEdit={setTrainIdToEdit}
              removeTrains={removeTrains}
            />
          ))}
      </div>
      <div className="scenario-timetable-warnings">
        {timetableHasInvalidTrain(displayedTrainSchedules) && (
          <div className="invalid-trains">
            <Alert size="lg" variant="fill" />
            <span data-testid="invalid-trains-message" className="flex-grow-1">
              {t('timetable.invalidTrains')}
            </span>
          </div>
        )}
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
    </div>
  );
};

export default Timetable;
