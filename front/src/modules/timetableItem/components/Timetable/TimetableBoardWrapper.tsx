import { useCallback, useMemo, useState } from 'react';

import { Download, PlusCircle } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import BoardWrapper from 'applications/operationalStudies/components/Scenario/BoardWrapper';
import { MANAGE_TIMETABLE_ITEM_TYPES } from 'applications/operationalStudies/consts';
import type { InfraState } from 'common/api/osrdEditoastApi';
import type {
  PacedTrainId,
  TimetableItem,
  TimetableItemId,
  TimetableItemToEditData,
  TrainScheduleId,
} from 'reducers/osrdconf/types';
import { isTrainScheduleId } from 'utils/trainId';

import Timetable from './Timetable';
import type { TimetableItemWithDetails } from './types';

type TimetableBoardWrapperProps = {
  setDisplayTimetableItemManagement: (mode: string) => void;
  infraState: InfraState;
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void;
  setTimetableItemToEditData: (timetableItemToEditData?: TimetableItemToEditData) => void;
  removeTimetableItems: (timetableItemsToRemove: TimetableItemId[]) => void;
  timetableItemToEditData?: TimetableItemToEditData;
  timetableItems?: TimetableItem[];
  timetableItemsWithDetails: TimetableItemWithDetails[];
};

const TimetableBoardWrapper = (props: TimetableBoardWrapperProps) => {
  const [selectedTimetableItemIds, setSelectedTimetableItemIds] = useState<TimetableItemId[]>([]);
  const { t } = useTranslation('operational-studies');

  const {
    timetableItemsWithDetails,
    timetableItems = [],
    setDisplayTimetableItemManagement,
  } = props;

  const { totalPacedTrainCount, totalTrainScheduleCount } = useMemo(
    () =>
      timetableItemsWithDetails.reduce(
        (acc, { id }) => {
          if (isTrainScheduleId(id)) {
            acc.totalTrainScheduleCount += 1;
          } else {
            acc.totalPacedTrainCount += 1;
          }
          return acc;
        },
        { totalPacedTrainCount: 0, totalTrainScheduleCount: 0 }
      ),
    [timetableItemsWithDetails]
  );

  const { selectedTrainScheduleIds, selectedPacedTrainIds } = useMemo(
    () =>
      selectedTimetableItemIds.reduce(
        (acc, timetableItemId) => {
          if (isTrainScheduleId(timetableItemId)) {
            acc.selectedTrainScheduleIds.push(timetableItemId);
          } else {
            acc.selectedPacedTrainIds.push(timetableItemId);
          }
          return acc;
        },
        { selectedTrainScheduleIds: [], selectedPacedTrainIds: [] } as {
          selectedTrainScheduleIds: TrainScheduleId[];
          selectedPacedTrainIds: PacedTrainId[];
        }
      ),
    [selectedTimetableItemIds]
  );

  const computedItemLabel = useCallback(() => {
    if (totalTrainScheduleCount === 0 && totalPacedTrainCount === 0)
      return t('main.timetable.noItem');

    const pacedTrainLabel = t('main.pacedTrainCountSelected', {
      count: selectedPacedTrainIds.length,
      totalCount: totalPacedTrainCount,
    });

    const trainScheduleLabel = t('main.trainCountSelected', {
      count: selectedTrainScheduleIds.length,
      totalCount: totalTrainScheduleCount,
    });

    if (totalTrainScheduleCount === 0) {
      return pacedTrainLabel;
    }

    if (totalPacedTrainCount === 0) {
      return trainScheduleLabel;
    }

    if (selectedTrainScheduleIds.length > 0 || selectedPacedTrainIds.length > 0) {
      return t('main.pacedTrainAndTrainCount', {
        pacedTrainCount: selectedPacedTrainIds.length,
        totalPacedTrainCount,
        trainCount: selectedTrainScheduleIds.length,
        totalTrainScheduleCount,
      });
    }

    return `${pacedTrainLabel}, ${trainScheduleLabel}`;
  }, [
    totalTrainScheduleCount,
    totalPacedTrainCount,
    selectedTrainScheduleIds,
    selectedPacedTrainIds,
  ]);
  return (
    <BoardWrapper
      visible
      name={timetableItems.length > 0 ? computedItemLabel() : t('main.timetable.noTrain')}
      items={[
        {
          title: t('main.timetable.addTimetableItem'),
          icon: <PlusCircle />,
          dataTestID: 'scenarios-add-timetable-item-button',
          onClick: () => setDisplayTimetableItemManagement(MANAGE_TIMETABLE_ITEM_TYPES.add),
        },
        {
          title: t('main.timetable.importTimetableItem'),
          icon: <Download />,
          dataTestID: 'scenarios-import-timetable-item-button',
          onClick: () => setDisplayTimetableItemManagement(MANAGE_TIMETABLE_ITEM_TYPES.import),
        },
      ]}
    >
      <Timetable
        selectedTrainScheduleIds={selectedTrainScheduleIds}
        selectedPacedTrainIds={selectedPacedTrainIds}
        selectedTimetableItemIds={selectedTimetableItemIds}
        setSelectedTimetableItemIds={setSelectedTimetableItemIds}
        {...props}
      />
    </BoardWrapper>
  );
};

export default TimetableBoardWrapper;
