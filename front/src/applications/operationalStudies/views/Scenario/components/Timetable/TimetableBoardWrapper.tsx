import { useCallback, useContext, useEffect, useMemo } from 'react';

import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import BoardWrapper from 'applications/operationalStudies/views/Scenario/components/BoardWrapper';
import DeleteModal from 'common/BootstrapSNCF/ModalSNCF/DeleteModal';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { useSubCategoryContext } from 'common/SubCategoryContext';
import { deleteTrainSchedules } from 'modules/timetableItem/helpers/updateTimetableItemHelpers';
import type { TimetableItemWithDetails } from 'modules/timetableItem/types';
import { setFailure, setSuccess } from 'reducers/main';
import type {
  TimetableItem,
  TimetableItemId,
  TimetableItemToEditData,
  TrainId,
} from 'reducers/osrdconf/types';
import { updateSelectedTrainId } from 'reducers/simulationResults';
import { getSelectedTrainId } from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';
import { mapBy } from 'utils/types';

import Timetable from './Timetable';
import { copyTimetableItemsToClipboard } from './utils';
import { validateTimetableJsonPayload } from '../ImportTimetableItem/helpers/parseJson';
import { postFullImportPayload } from '../ImportTimetableItem/helpers/postPayloads';

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
  selectedTimetableItemIds: TimetableItemId[];
  setSelectedTimetableItemIds: React.Dispatch<React.SetStateAction<TimetableItemId[]>>;
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
  selectedTimetableItemIds,
  setSelectedTimetableItemIds,
}: TimetableBoardWrapperProps) => {
  const { openModal } = useContext(ModalContext);

  const { scenario, sandboxId } = useScenarioContext();

  const selectedTrainId = useSelector(getSelectedTrainId);

  const { t } = useTranslation('operational-studies');

  const subCategories = useSubCategoryContext();

  const dispatch = useAppDispatch();

  const { totalPacedTrainCount, totalUniqueTrainCount } = useMemo(
    () =>
      timetableItems.reduce(
        (acc, timetableItem) => {
          if (!timetableItem.paced) {
            acc.totalUniqueTrainCount += 1;
          } else {
            acc.totalPacedTrainCount += 1;
          }
          return acc;
        },
        { totalPacedTrainCount: 0, totalUniqueTrainCount: 0 }
      ),
    [timetableItems]
  );

  const { selectedUniqueTrainIds, selectedPacedTrainIds } = useMemo(() => {
    const timetableItemsById = mapBy(timetableItemsWithDetails, 'id');
    return selectedTimetableItemIds.reduce(
      (acc, timetableItemId) => {
        const pacedTrain = timetableItemsById.get(timetableItemId);
        if (!pacedTrain) throw new Error(`No timetableItem found for id ${timetableItemId}`);
        if (!pacedTrain.paced) acc.selectedUniqueTrainIds.push(timetableItemId);
        else acc.selectedPacedTrainIds.push(timetableItemId);
        return acc;
      },
      { selectedUniqueTrainIds: [], selectedPacedTrainIds: [] } as {
        selectedUniqueTrainIds: TimetableItemId[];
        selectedPacedTrainIds: TimetableItemId[];
      }
    );
  }, [selectedTimetableItemIds]);

  // --- BOARD WRAPPER TITLE MANAGEMENT -------------------------
  const computedItemLabel = useCallback(() => {
    if (totalUniqueTrainCount === 0 && totalPacedTrainCount === 0)
      return t('main.timetable.noItem');

    const pacedTrainLabel =
      selectedPacedTrainIds.length > 0
        ? t('main.pacedTrainCountSelected', {
            count: selectedPacedTrainIds.length,
            totalCount: totalPacedTrainCount,
          })
        : t('main.pacedTrain', { count: totalPacedTrainCount });

    const uniqueTrainLabel =
      selectedUniqueTrainIds.length > 0
        ? t('main.trainCountSelected', {
            count: selectedUniqueTrainIds.length,
            totalCount: totalUniqueTrainCount,
          })
        : t('main.train', { count: totalUniqueTrainCount });

    if (totalUniqueTrainCount === 0) {
      return pacedTrainLabel;
    }

    if (totalPacedTrainCount === 0) {
      return uniqueTrainLabel;
    }

    if (selectedUniqueTrainIds.length > 0 || selectedPacedTrainIds.length > 0) {
      return t('main.pacedTrainAndTrainCount', {
        pacedTrainCount: selectedPacedTrainIds.length,
        totalPacedTrainCount,
        trainCount: selectedUniqueTrainIds.length,
        totalUniqueTrainCount,
      });
    }

    return `${pacedTrainLabel}, ${uniqueTrainLabel}`;
  }, [totalUniqueTrainCount, totalPacedTrainCount, selectedUniqueTrainIds, selectedPacedTrainIds]);
  // --- END BOARD WRAPPER TITLE MANAGEMENT ---------------------

  const removeAndUnselectTrains = useCallback(
    (timetableItemIds: TimetableItemId[]) => {
      removeTimetableItems(timetableItemIds);
    },
    [removeTimetableItems, setSelectedTimetableItemIds]
  );

  const handleTrainsDelete = async (
    currentSelectedTrainId?: TrainId,
    hideToast: boolean = false
  ) => {
    const itemsCount = selectedTimetableItemIds.length;

    const isSelectedTimetableItemInSelection =
      currentSelectedTrainId !== undefined &&
      selectedTimetableItemIds.some((timetableItemId) =>
        currentSelectedTrainId.includes(timetableItemId)
      );

    if (isSelectedTimetableItemInSelection) {
      // we need to set selectedTrainId to undefined, otherwise just after the delete,
      // some unvalid rtk calls are dispatched (see rollingstock request in SimulationResults)
      dispatch(updateSelectedTrainId(undefined));
    }

    try {
      if (selectedTimetableItemIds.length > 0) {
        await deleteTrainSchedules(dispatch, selectedTimetableItemIds);
      }

      removeAndUnselectTrains(selectedTimetableItemIds);

      if (!hideToast) {
        dispatch(
          setSuccess({
            title: t('main.timetable.itemsSelectionDeletedCount', { count: itemsCount }),
            text: '',
          })
        );
      }
    } catch (e) {
      if (isSelectedTimetableItemInSelection) {
        dispatch(updateSelectedTrainId(currentSelectedTrainId));
      } else {
        dispatch(setFailure(castErrorToFailure(e)));
      }
    }
  };

  // --- END BOARD WRAPPER MENU ITEMS CONFIGURATION ---

  const handleCopy = useCallback(async () => {
    const selectedText = document.getSelection()?.toString();
    if (selectedText !== undefined && selectedText.length > 0) return;

    if (selectedTimetableItemIds.length === 0) {
      return;
    }

    await copyTimetableItemsToClipboard(selectedTimetableItemIds, timetableItems);
    dispatch(
      setSuccess({
        title: t('main.copyTimetable.title'),
        text: t('main.copyTimetable.text', { count: selectedTimetableItemIds.length }),
      })
    );
  }, [selectedTimetableItemIds, timetableItems]);

  const handlePaste = useCallback(async () => {
    let data = null;
    const clipboardContent = await navigator.clipboard.readText();
    try {
      data = JSON.parse(clipboardContent);
      const importedPayload = validateTimetableJsonPayload(data);

      const newTimetableItems = await postFullImportPayload(
        sandboxId,
        scenario.id,
        importedPayload,
        subCategories,
        dispatch,
        t,
        upsertTimetableItems
      );

      setSelectedTimetableItemIds(newTimetableItems.map((item) => item.id));
      dispatch(
        setSuccess({
          title: t('main.pasteTimetable.title'),
          text: t('main.pasteTimetable.text', { count: newTimetableItems.length }),
        })
      );
    } catch (e) {
      if (data && data.paced_trains) {
        dispatch(setFailure(castErrorToFailure(e)));
      }
    }
  }, [sandboxId]);

  const handleCut = useCallback(
    async (event: ClipboardEvent) => {
      const selectedText = document.getSelection()?.toString();
      if (selectedText !== undefined && selectedText.length > 0) return;

      if (selectedTimetableItemIds.length === 0) {
        return;
      }

      event.preventDefault();
      await copyTimetableItemsToClipboard(selectedTimetableItemIds, timetableItems);
      await handleTrainsDelete(selectedTrainId, true);
      dispatch(
        setSuccess({
          title: t('main.cutTimetable.title'),
          text: t('main.cutTimetable.text', { count: selectedTimetableItemIds.length }),
        })
      );
    },
    [selectedTimetableItemIds, timetableItems]
  );

  const handleDeleteTimetableItems = () => {
    openModal(
      <DeleteModal
        handleDelete={() => handleTrainsDelete(selectedTrainId)}
        selectedPacedTrainCount={selectedPacedTrainIds.length}
        selectedUniqueTrainCount={selectedUniqueTrainIds.length}
      />,
      'sm'
    );
  };

  useEffect(() => {
    document.addEventListener('copy', handleCopy);
    return () => document.removeEventListener('copy', handleCopy);
  }, [handleCopy]);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  useEffect(() => {
    document.addEventListener('cut', handleCut);
    return () => document.removeEventListener('cut', handleCut);
  }, [handleCut]);

  return (
    <BoardWrapper withFooter name={computedItemLabel()} dataTestId="timetable-board-wrapper">
      <Timetable
        selectedTimetableItemIds={selectedTimetableItemIds}
        setSelectedTimetableItemIds={setSelectedTimetableItemIds}
        setDisplayTimetableItemManagement={setDisplayTimetableItemManagement}
        upsertTimetableItems={upsertTimetableItems}
        setTimetableItemToEditData={setTimetableItemToEditData}
        removeAndUnselectTrains={removeTimetableItems}
        handleDeleteTimetableItems={handleDeleteTimetableItems}
        timetableItemToEditData={timetableItemToEditData}
        timetableItems={timetableItems}
        timetableItemsWithDetails={timetableItemsWithDetails}
        refreshNge={refreshNge}
        projectingOnSimulatedPathException={projectingOnSimulatedPathException}
      />
    </BoardWrapper>
  );
};

export default TimetableBoardWrapper;
