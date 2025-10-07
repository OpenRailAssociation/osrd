import { useCallback, useContext, useMemo, useState } from 'react';

import {
  ArrowSwitch,
  Check,
  Clear,
  Download,
  Note,
  PlusCircle,
  Trash,
  Upload,
} from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import BoardWrapper from 'applications/operationalStudies/views/Scenario/components/BoardWrapper';
import RoundTripsModal from 'applications/operationalStudies/views/Scenario/components/RoundTrips/RoundTripsModal';
import { MANAGE_TIMETABLE_ITEM_TYPES } from 'applications/operationalStudies/views/Scenario/consts';
import DeleteModal from 'common/BootstrapSNCF/ModalSNCF/DeleteModal';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import {
  deletePacedTrains,
  deleteTrainSchedules,
} from 'modules/timetableItem/helpers/updateTimetableItemHelpers';
import type { TimetableItemWithDetails } from 'modules/timetableItem/types';
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
import { isTrainScheduleId } from 'utils/trainId';

import Timetable from './Timetable';
import useFilterTimetableItems from './useFilterTimetableItems';
import { exportTimetableItems } from './utils';

type TimetableBoardWrapperProps = {
  setDisplayTimetableItemManagement: (mode: string) => void;
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void;
  setTimetableItemToEditData: (timetableItemToEditData?: TimetableItemToEditData) => void;
  removeTimetableItems: (timetableItemsToRemove: TimetableItemId[]) => void;
  timetableItemToEditData?: TimetableItemToEditData;
  timetableItems?: TimetableItem[];
  timetableItemsWithDetails: TimetableItemWithDetails[];
  refreshNge: () => Promise<void>;
  projectingOnSimulatedPathException: boolean | undefined;
};

const TimetableBoardWrapper = ({
  setDisplayTimetableItemManagement,
  upsertTimetableItems,
  setTimetableItemToEditData,
  removeTimetableItems,
  timetableItemToEditData,
  timetableItems = [],
  timetableItemsWithDetails,
  refreshNge,
  projectingOnSimulatedPathException,
}: TimetableBoardWrapperProps) => {
  const [selectedTimetableItemIds, setSelectedTimetableItemIds] = useState<TimetableItemId[]>([]);
  const [showTrainDetails, setShowTrainDetails] = useState(false);
  const [roundTripsModalIsOpen, setRoundTripsModalIsOpen] = useState(false);

  const { infraId, timetableId } = useScenarioContext();
  const { openModal } = useContext(ModalContext);

  const { t } = useTranslation('operational-studies');

  const dispatch = useAppDispatch();

  const selectedTrainId = useSelector(getSelectedTrainId);

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

  // --- BOARD WRAPPER TITLE MANAGEMENT -------------------------
  const computedItemLabel = useCallback(() => {
    if (totalTrainScheduleCount === 0 && totalPacedTrainCount === 0)
      return t('main.timetable.noItem');

    const pacedTrainLabel =
      selectedPacedTrainIds.length > 0
        ? t('main.pacedTrainCountSelected', {
            count: selectedPacedTrainIds.length,
            totalCount: totalPacedTrainCount,
          })
        : t('main.pacedTrain', { count: totalPacedTrainCount });

    const trainScheduleLabel =
      selectedTrainScheduleIds.length > 0
        ? t('main.trainCountSelected', {
            count: selectedTrainScheduleIds.length,
            totalCount: totalTrainScheduleCount,
          })
        : t('main.train', { count: totalTrainScheduleCount });

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
  // --- END BOARD WRAPPER TITLE MANAGEMENT ---------------------

  // --- BOARD WRAPPER MENU ITEMS CONFIGURATION ---
  const { filteredTimetableItems, ...timetableFilters } =
    useFilterTimetableItems(timetableItemsWithDetails);

  const toggleShowTrainDetails = () => {
    setShowTrainDetails(!showTrainDetails);
  };

  const toggleAllTrainsSelecton = () => {
    if (filteredTimetableItems.length === selectedTimetableItemIds.length) {
      setSelectedTimetableItemIds([]);
    } else {
      const timetableItemsDisplayed = filteredTimetableItems.map(({ id }) => id);
      setSelectedTimetableItemIds(timetableItemsDisplayed);
    }
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

    try {
      let deletingTrainSchedulesPromise;
      let deletingPacedTrainsPromise;
      if (selectedTrainScheduleIds.length > 0) {
        deletingTrainSchedulesPromise = deleteTrainSchedules(dispatch, selectedTrainScheduleIds);
      }
      if (selectedPacedTrainIds.length > 0) {
        deletingPacedTrainsPromise = deletePacedTrains(dispatch, selectedPacedTrainIds);
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

  const getMenuItems = () => {
    const areAllItemsSelected =
      selectedTimetableItemIds.length === timetableItemsWithDetails.length &&
      selectedTimetableItemIds.length > 0;

    const baseMenuItems = [
      {
        title: t('main.roundTripsModal.manageRoundTrips'),
        icon: <ArrowSwitch />,
        dataTestID: 'scenarios-manage-round-trips-button',
        onClick: () => setRoundTripsModalIsOpen(true),
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
    ];

    const itemsMenuItems =
      timetableItemsWithDetails.length > 0
        ? [
            {
              title: showTrainDetails ? t('main.lessDetails') : t('main.moreDetails'),
              icon: <Note />,
              dataTestID: 'scenarios-show-train-details-button',
              onClick: () => toggleShowTrainDetails(),
            },
            {
              title: areAllItemsSelected
                ? t('main.timetable.unselectAll')
                : t('main.timetable.selectAll'),
              icon: areAllItemsSelected ? <Clear /> : <Check />,
              dataTestID: 'scenarios-select-all-button',
              onClick: () => toggleAllTrainsSelecton(),
            },
          ]
        : [];

    const selectionMenuItems =
      selectedTimetableItemIds.length > 0
        ? [
            {
              title: t('main.timetable.exportSelection'),
              icon: <Upload />,
              dataTestID: 'scenarios-export-timetable-item-button',
              onClick: () => exportTimetableItems(selectedTimetableItemIds, timetableItems),
            },
            {
              title: t('main.timetable.deleteSelection'),
              icon: <Trash />,
              dataTestID: 'delete-all-items-button',
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
          ]
        : [];

    return [...itemsMenuItems, ...baseMenuItems, ...selectionMenuItems];
  };
  // --- END BOARD WRAPPER MENU ITEMS CONFIGURATION ---

  return (
    <>
      <BoardWrapper
        withFooter
        name={timetableItems.length > 0 ? computedItemLabel() : t('main.timetable.noTrain')}
        items={getMenuItems()}
        dataTestId="timetable-board-wrapper"
      >
        <Timetable
          selectedTimetableItemIds={selectedTimetableItemIds}
          filteredTimetableItems={filteredTimetableItems}
          timetableFilters={timetableFilters}
          setSelectedTimetableItemIds={setSelectedTimetableItemIds}
          setDisplayTimetableItemManagement={setDisplayTimetableItemManagement}
          upsertTimetableItems={upsertTimetableItems}
          setTimetableItemToEditData={setTimetableItemToEditData}
          removeAndUnselectTrains={removeAndUnselectTrains}
          timetableItemToEditData={timetableItemToEditData}
          timetableItems={timetableItems}
          showTrainDetails={showTrainDetails}
          projectingOnSimulatedPathException={projectingOnSimulatedPathException}
        />
      </BoardWrapper>
      {roundTripsModalIsOpen && (
        <RoundTripsModal
          roundTripsModalIsOpen={roundTripsModalIsOpen}
          setRoundTripsModalIsOpen={setRoundTripsModalIsOpen}
          infraId={infraId}
          timetableId={timetableId}
          timetableItems={timetableItems}
          refreshNge={refreshNge}
        />
      )}
    </>
  );
};

export default TimetableBoardWrapper;
