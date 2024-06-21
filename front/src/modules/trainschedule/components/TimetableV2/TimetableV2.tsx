import React, { useEffect, useMemo, useState } from 'react';

import { Alert, Download, Plus } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { compact } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import type { TrainSpaceTimeData } from 'applications/operationalStudies/types';
import type { ConflictV2, InfraState } from 'common/api/osrdEditoastApi';
import ConflictsListV2 from 'modules/conflict/components/ConflictsListV2';
import { updateSelectedTrainId } from 'reducers/osrdsimulation/actions';
import { getTrainIdUsedForProjection } from 'reducers/osrdsimulation/selectors';
import { useAppDispatch } from 'store';
import { distributedIntervalsFromArrayOfValues, valueToInterval } from 'utils/numbers';

import TimetableToolbar from './TimetableToolbar';
import TimetableTrainCardV2 from './TimetableTrainCardV2';
import type { TrainScheduleWithDetails } from './types';
import { timetableHasInvalidTrain } from './utils';

type TimetableV2Props = {
  setDisplayTrainScheduleManagement: (mode: string) => void;
  trainsWithDetails: boolean;
  infraState: InfraState;
  trainIds: number[];
  selectedTrainId?: number;
  conflicts?: ConflictV2[];
  setTrainResultsToFetch: (trainScheduleIds?: number[]) => void;
  setTrainIdToEdit: (trainId?: number) => void;
  setSpaceTimeData: React.Dispatch<React.SetStateAction<TrainSpaceTimeData[]>>;
  trainIdToEdit?: number;
};

const TimetableV2 = ({
  setDisplayTrainScheduleManagement,
  trainsWithDetails,
  infraState,
  trainIds,
  selectedTrainId,
  conflicts,
  setTrainResultsToFetch,
  setSpaceTimeData,
  setTrainIdToEdit,
  trainIdToEdit,
}: TimetableV2Props) => {
  const { t } = useTranslation(['operationalStudies/scenario', 'common/itemTypes']);

  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);

  const [trainSchedulesDetails, setTrainSchedulesDetails] = useState<TrainScheduleWithDetails[]>(
    []
  );
  const [conflictsListExpanded, setConflictsListExpanded] = useState(false);
  const [multiselectOn, setMultiselectOn] = useState(false);
  const [selectedTrainIds, setSelectedTrainIds] = useState<number[]>([]);

  const dispatch = useAppDispatch();

  const trainsDurationsIntervals = useMemo(
    () =>
      trainSchedulesDetails.length > 0
        ? distributedIntervalsFromArrayOfValues(
            compact(trainSchedulesDetails.map((train) => train.duration))
          )
        : [],
    [trainSchedulesDetails]
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

  const handleConflictClick = (conflict: ConflictV2) => {
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
        trainIds={trainIds}
        trainSchedulesDetails={trainSchedulesDetails}
        setTrainSchedulesDetails={setTrainSchedulesDetails}
        selectedTrainIds={selectedTrainIds}
        setSelectedTrainIds={setSelectedTrainIds}
        multiSelectOn={multiselectOn}
        setMultiSelectOn={setMultiselectOn}
        setTrainResultsToFetch={setTrainResultsToFetch}
        setSpaceTimeData={setSpaceTimeData}
      />

      <div
        className={cx('scenario-timetable-trains', {
          expanded: conflictsListExpanded,
          'with-details': trainsWithDetails,
        })}
      >
        {trainsDurationsIntervals &&
          trainSchedulesDetails.map((train: TrainScheduleWithDetails, idx: number) => (
            <TimetableTrainCardV2
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
              setTrainResultsToFetch={setTrainResultsToFetch}
              setTrainIdToEdit={setTrainIdToEdit}
              setSpaceTimeData={setSpaceTimeData}
            />
          ))}
      </div>
      <div className="scenario-timetable-warnings">
        {timetableHasInvalidTrain(trainSchedulesDetails) && (
          <div className="invalid-trains">
            <Alert size="lg" variant="fill" />
            <span className="flex-grow-1">{t('timetable.invalidTrains')}</span>
          </div>
        )}
        {conflicts && (
          <ConflictsListV2
            conflicts={conflicts}
            expanded={conflictsListExpanded}
            toggleConflictsList={toggleConflictsListExpanded}
            trainSchedulesDetails={trainSchedulesDetails}
            onConflictClick={handleConflictClick}
          />
        )}
      </div>
    </div>
  );
};

export default TimetableV2;
