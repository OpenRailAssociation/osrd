import { useCallback, useContext, useMemo, useState } from 'react';

import { Check, Download, Note, PlusCircle, Trash, Upload } from '@osrd-project/ui-icons';
import { omit } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import BoardWrapper from 'applications/operationalStudies/components/Scenario/BoardWrapper';
import { MANAGE_TIMETABLE_ITEM_TYPES } from 'applications/operationalStudies/consts';
import {
  osrdEditoastApi,
  type InfraState,
  type PacedTrain,
  type TrainSchedule,
} from 'common/api/osrdEditoastApi';
import DeleteModal from 'common/BootstrapSNCF/ModalSNCF/DeleteModal';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { setFailure, setSuccess } from 'reducers/main';
import type {
  PacedTrainId,
  TimetableItem,
  TimetableItemId,
  TimetableItemToEditData,
  TrainId,
  TrainScheduleId,
} from 'reducers/osrdconf/types';
import { updateSelectedTrainId } from 'reducers/simulationResults';
import { getSelectedTrainId } from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';
import {
  extractEditoastIdFromPacedTrainId,
  extractEditoastIdFromTrainScheduleId,
  isPacedTrainResponseWithPacedTrainId,
  isTrainScheduleId,
} from 'utils/trainId';

import Timetable from './Timetable';
import type { TimetableItemWithDetails } from './types';
import useFilterTimetableItems from './useFilterTimetableItems';

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

const TimetableBoardWrapper = ({
  setDisplayTimetableItemManagement,
  infraState,
  upsertTimetableItems,
  setTimetableItemToEditData,
  removeTimetableItems,
  timetableItemToEditData,
  timetableItems = [],
  timetableItemsWithDetails,
}: TimetableBoardWrapperProps) => {
  const [selectedTimetableItemIds, setSelectedTimetableItemIds] = useState<TimetableItemId[]>([]);
  const [showTrainDetails, setShowTrainDetails] = useState(false);
  const { t } = useTranslation('operational-studies');

  const dispatch = useAppDispatch();

  const selectedTrainId = useSelector(getSelectedTrainId);

  const [deleteTrainSchedules] = osrdEditoastApi.endpoints.deleteTrainSchedule.useMutation();
  const [deletePacedTrains] = osrdEditoastApi.endpoints.deletePacedTrain.useMutation();

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

  const { openModal } = useContext(ModalContext);

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

  const { filteredTimetableItems, ...timetableFilters } =
    useFilterTimetableItems(timetableItemsWithDetails);

  const toggleAllTrainsSelecton = () => {
    if (filteredTimetableItems.length === selectedTimetableItemIds.length) {
      setSelectedTimetableItemIds([]);
    } else {
      const timetableItemsDisplayed = filteredTimetableItems.map(({ id }) => id);
      setSelectedTimetableItemIds(timetableItemsDisplayed);
    }
  };

  const exportTimetableItems = (selectedTimeTableIdsFromClick: TimetableItemId[]) => {
    if (!timetableItems) return;

    const formattedTimetableItems = timetableItems
      .filter(({ id }) => selectedTimeTableIdsFromClick.includes(id))
      .reduce<{
        train_schedules: TrainSchedule[];
        paced_trains: PacedTrain[];
      }>(
        (acc, timetableItem) => {
          if (isPacedTrainResponseWithPacedTrainId(timetableItem)) {
            acc.paced_trains.push(omit(timetableItem, ['id']));
          } else {
            acc.train_schedules.push(omit(timetableItem, ['id']));
          }
          return acc;
        },
        { train_schedules: [], paced_trains: [] }
      );

    const jsonString = JSON.stringify(formattedTimetableItems);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'timetable.json';
    a.click();
  };

  const removeAndUnselectTrains = useCallback(
    (timetableItemIds: TimetableItemId[]) => {
      removeTimetableItems(timetableItemIds);
      setSelectedTimetableItemIds([]);
    },
    [removeTimetableItems, setSelectedTimetableItemIds]
  );

  const handleTrainsDelete = async (currentSelectedTrainId?: TrainId) => {
    const itemsCount = selectedTimetableItemIds.length;

    const isSelectedTimetableItemInSelection =
      currentSelectedTrainId !== undefined &&
      selectedTimetableItemIds.some((timetableItemId) =>
        isTrainScheduleId(timetableItemId)
          ? timetableItemId === currentSelectedTrainId
          : currentSelectedTrainId.includes(timetableItemId)
      );

    if (isSelectedTimetableItemInSelection) {
      // we need to set selectedTrainId to undefined, otherwise just after the delete,
      // some unvalid rtk calls are dispatched (see rollingstock request in SimulationResults)
      dispatch(updateSelectedTrainId(undefined));
    }

    const editoastSelectedTrainScheduleIds = selectedTrainScheduleIds.map((id) =>
      extractEditoastIdFromTrainScheduleId(id)
    );
    const editoastSelectedPacedTrainIds = selectedPacedTrainIds.map((id) =>
      extractEditoastIdFromPacedTrainId(id)
    );

    try {
      let deletingTrainSchedulesPromise;
      let deletingPacedTrainsPromise;
      if (editoastSelectedTrainScheduleIds.length > 0) {
        deletingTrainSchedulesPromise = deleteTrainSchedules({
          body: { ids: editoastSelectedTrainScheduleIds },
        }).unwrap();
      }
      if (editoastSelectedPacedTrainIds.length > 0) {
        deletingPacedTrainsPromise = deletePacedTrains({
          body: { ids: editoastSelectedPacedTrainIds },
        }).unwrap();
      }
      await Promise.all([deletingTrainSchedulesPromise, deletingPacedTrainsPromise]);

      removeAndUnselectTrains(selectedTimetableItemIds);
      dispatch(
        setSuccess({
          title: t('main.timetable.itemsSelectionDeletedCount', { count: itemsCount }),
          text: '',
        })
      );
    } catch (e) {
      if (isSelectedTimetableItemInSelection) {
        dispatch(updateSelectedTrainId(currentSelectedTrainId));
      } else {
        dispatch(setFailure(castErrorToFailure(e)));
      }
    }
  };

  const toggleShowTrainDetails = () => {
    setShowTrainDetails(!showTrainDetails);
  };

  return (
    <BoardWrapper
      visible
      withFooter
      name={timetableItems.length > 0 ? computedItemLabel() : t('main.timetable.noTrain')}
      items={[
        {
          title: showTrainDetails ? t('main.lessDetails') : t('main.moreDetails'),
          icon: <Note />,
          dataTestID: 'scenarios-show-train-details-button',
          disabled: timetableItemsWithDetails.length === 0,
          onClick: () => toggleShowTrainDetails(),
        },
        {
          title:
            selectedTimetableItemIds.length === timetableItemsWithDetails.length &&
            selectedTimetableItemIds.length > 0
              ? t('main.timetable.unselectAll')
              : t('main.timetable.selectAll'),
          icon: <Check />,
          dataTestID: 'scenarios-select-all-button',
          disabled: timetableItemsWithDetails.length === 0,
          onClick: () => toggleAllTrainsSelecton(),
        },
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
        {
          title: t('main.timetable.exportSelection'),
          icon: <Upload />,
          dataTestID: 'scenarios-export-timetable-item-button',
          disabled: selectedTimetableItemIds.length === 0,
          onClick: () => exportTimetableItems(selectedTimetableItemIds),
        },
        {
          title: t('main.timetable.deleteSelection'),
          icon: <Trash />,
          dataTestID: 'delete-all-items-button',
          disabled: selectedTimetableItemIds.length === 0,
          onClick: () =>
            openModal(
              <DeleteModal
                handleDelete={() => handleTrainsDelete(selectedTrainId)}
                selectedPacedTrainIds={selectedPacedTrainIds}
                selectedTrainScheduleIds={selectedTrainScheduleIds}
              />,
              'sm'
            ),
        },
      ]}
    >
      <Timetable
        selectedTimetableItemIds={selectedTimetableItemIds}
        filteredTimetableItems={filteredTimetableItems}
        timetableFilters={timetableFilters}
        setSelectedTimetableItemIds={setSelectedTimetableItemIds}
        setDisplayTimetableItemManagement={setDisplayTimetableItemManagement}
        infraState={infraState}
        upsertTimetableItems={upsertTimetableItems}
        setTimetableItemToEditData={setTimetableItemToEditData}
        removeAndUnselectTrains={removeAndUnselectTrains}
        timetableItemToEditData={timetableItemToEditData}
        timetableItems={timetableItems}
        showTrainDetails={showTrainDetails}
      />
    </BoardWrapper>
  );
};

export default TimetableBoardWrapper;
