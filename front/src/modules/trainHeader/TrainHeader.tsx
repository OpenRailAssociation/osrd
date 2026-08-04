import { useCallback, useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import { updateTrainSchedule } from 'applications/operationalStudies/views/Scenario/components/ManageTrainSchedule/hooks/useUpdateTrainSchedule';
import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/views/Scenario/consts';
import type { PathfindingResult, TrainScheduleResponse } from 'common/api/osrdEditoastApi';
import useFilterRollingStock from 'modules/rollingStock/hooks/useFilterRollingStock';
import type { TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import { setFailure } from 'reducers/main';
import { selectTrainToEdit } from 'reducers/osrdconf/operationalStudiesConf';
import type { Train, TrainScheduleToEditData } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { extractEditoastIdFromTrainId, isOccurrenceId } from 'utils/trainId';

import CollapsedTrainOverview from './CollapsedTrainOverview';
import ExpandedTrainForm from './ExpandedTrainForm';
import { applyOccurrenceOnPacedTrain } from './utils/applyOccurrenceOnPacedTrain';

export type TrainHeaderProps = {
  train: Train;
  path?: Omit<PathfindingResult, 'status'>;
  trainSchedulesWithDetails: TrainScheduleWithDetails[];
  upsertTrainSchedules: (trainSchedules: TrainScheduleResponse[]) => void;
  setDisplayTrainScheduleManagement: (type: string) => void;
  setTrainScheduleToEditData: (trainScheduleToEditData?: TrainScheduleToEditData) => void;
};

export type ExtraOccurrencesChanges = {
  addedExceptions?: { startTime: Date }[];
  deletedAddedExceptionId?: number;
};

/**
 * A dual-purpose header that shows either a collapsed overview on some key train characteristics,
 * or an expanded form that allow the user to edit every data about the train outside of the train
 * stops themselves or its itinerary.
 */
const TrainHeader = ({
  train,
  path,
  trainSchedulesWithDetails,
  upsertTrainSchedules,
  setDisplayTrainScheduleManagement,
  setTrainScheduleToEditData,
}: TrainHeaderProps) => {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation(['operational-studies']);

  const dispatch = useAppDispatch();
  const { timetableId } = useScenarioContext();
  const occurrenceId = isOccurrenceId(train.id) ? train.id : undefined;
  const trainScheduleId = extractEditoastIdFromTrainId(train.id);
  const { filteredRollingStockList: rollingStocks } = useFilterRollingStock();

  // TODO: As soon as we ditch the old train edition modal, we should switch to a TrainSchedule instead
  //       of a TrainScheduleWithDetails as we have no need for the "details" in this form.
  const originalTrainSchedule = useMemo(
    () => trainSchedulesWithDetails.find((tr) => tr.id === trainScheduleId)!,
    [trainScheduleId, trainSchedulesWithDetails]
  );

  const onPersistTrain = async (
    updatedTrain: Train,
    extraOccurrencesChanges?: ExtraOccurrencesChanges
  ) => {
    const result = await updateTrainSchedule({
      upsertTrainSchedules,
      trainScheduleId,
      originalTrainSchedule,
      occurrenceId,
      updatedTrainSchedule: updatedTrain,
      timetableId,
      addedExceptions: extraOccurrencesChanges?.addedExceptions ?? [],
      deletedAddedExceptionId: extraOccurrencesChanges?.deletedAddedExceptionId,
      dispatch,
    });

    if (!result.success) {
      for (const errorCode of result.errorCodes) {
        dispatch(
          setFailure({
            name: t('manageTrainSchedule.errorMessages.trainScheduleTitle'),
            message: t(`manageTrainSchedule.errorMessages.${errorCode}`),
          })
        );
      }
    }
  };

  const onItineraryOpened = useCallback(() => {
    dispatch(
      selectTrainToEdit({
        trainSchedule: occurrenceId
          ? applyOccurrenceOnPacedTrain(originalTrainSchedule, train, occurrenceId, rollingStocks)
          : originalTrainSchedule,
        isOccurrence: !!occurrenceId,
      })
    );
    setTrainScheduleToEditData({
      trainScheduleId,
      originalTrainSchedule: originalTrainSchedule ?? train,
      occurrenceId,
    });
    setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.itinerary);
  }, [
    train,
    originalTrainSchedule,
    trainScheduleId,
    occurrenceId,
    rollingStocks,
    dispatch,
    setDisplayTrainScheduleManagement,
    setTrainScheduleToEditData,
  ]);

  if (expanded) {
    return (
      <ExpandedTrainForm
        key={`form-${train.id}` /* Invalidate the form's state if we select another train */}
        train={train}
        path={path}
        onCollapse={() => {
          setExpanded(false);
        }}
        onPersistTrain={onPersistTrain}
        onItineraryOpened={onItineraryOpened}
      />
    );
  }

  return (
    <CollapsedTrainOverview
      train={train}
      onExpand={() => {
        setExpanded(true);
      }}
      onItineraryOpened={onItineraryOpened}
    />
  );
};

export default TrainHeader;
