import { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import { useTimetableContext } from 'applications/operationalStudies/hooks/useTimetableContext';
import BoardWrapper from 'applications/operationalStudies/views/Scenario/components/BoardWrapper';
import DeleteModal from 'common/BootstrapSNCF/ModalSNCF/DeleteModal';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { useSubCategoryContext } from 'common/SubCategoryContext';
import { deleteTrainSchedules } from 'modules/trainSchedule/helpers/updateTrainScheduleHelpers';
import type { TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import { setFailure, setSuccess } from 'reducers/main';
import type { TrainScheduleToEditData, TrainId } from 'reducers/osrdconf/types';
import { updateSelectedTrain } from 'reducers/simulationResults';
import { getSelectedTrain } from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';
import { mapBy } from 'utils/types';

import { validateTimetableJsonPayload } from '../ImportTrainSchedule/helpers/parseJson';
import { postFullImportPayload } from '../ImportTrainSchedule/helpers/postPayloads';
import Timetable from './Timetable';
import { copyTrainSchedulesToClipboard } from './utils';

type TimetableBoardWrapperProps = {
  setDisplayTrainScheduleManagement: (mode: string) => void;
  setTrainScheduleToEditData: (trainScheduleToEditData?: TrainScheduleToEditData) => void;
  trainScheduleToEditData?: TrainScheduleToEditData;
  trainSchedulesWithDetails: TrainScheduleWithDetails[];
  refreshNge: () => Promise<void>;
  projectingOnSimulatedPathException: boolean | undefined;
  selectedTrainScheduleIds: number[];
  setSelectedTrainScheduleIds: React.Dispatch<React.SetStateAction<number[]>>;
};

const TimetableBoardWrapper = ({
  setDisplayTrainScheduleManagement,
  setTrainScheduleToEditData,
  trainScheduleToEditData,
  trainSchedulesWithDetails,
  refreshNge,
  projectingOnSimulatedPathException,
  selectedTrainScheduleIds,
  setSelectedTrainScheduleIds,
}: TimetableBoardWrapperProps) => {
  const { openModal } = useContext(ModalContext);

  const { scenario, sandboxId } = useScenarioContext();
  const { trainSchedules, removeTrainSchedules, upsertTrainSchedules } = useTimetableContext();

  const { id: selectedTrainId } = useSelector(getSelectedTrain) || {};

  const { t } = useTranslation('operational-studies');

  const subCategories = useSubCategoryContext();

  const dispatch = useAppDispatch();

  const [isSelectMode, setIsSelectMode] = useState(false);

  const { totalPacedTrainCount, totalUniqueTrainCount } = useMemo(
    () =>
      trainSchedules.reduce(
        (acc, trainSchedule) => {
          if (!trainSchedule.paced) {
            acc.totalUniqueTrainCount += 1;
          } else {
            acc.totalPacedTrainCount += 1;
          }
          return acc;
        },
        { totalPacedTrainCount: 0, totalUniqueTrainCount: 0 }
      ),
    [trainSchedules]
  );

  const { selectedUniqueTrainIds, selectedPacedTrainIds } = useMemo(() => {
    const trainSchedulesById = mapBy(trainSchedulesWithDetails, 'id');
    return selectedTrainScheduleIds.reduce(
      (acc, trainScheduleId) => {
        const trainSchedule = trainSchedulesById.get(trainScheduleId);
        if (!trainSchedule) throw new Error(`No train schedule found for id ${trainScheduleId}`);
        if (!trainSchedule.paced) acc.selectedUniqueTrainIds.push(trainScheduleId);
        else acc.selectedPacedTrainIds.push(trainScheduleId);
        return acc;
      },
      { selectedUniqueTrainIds: [], selectedPacedTrainIds: [] } as {
        selectedUniqueTrainIds: number[];
        selectedPacedTrainIds: number[];
      }
    );
  }, [selectedTrainScheduleIds]);

  // --- BOARD WRAPPER TITLE MANAGEMENT -------------------------
  const computedTrainLabel = useCallback(() => {
    if (totalUniqueTrainCount === 0 && totalPacedTrainCount === 0)
      return t('main.timetable.noTrainSchedule');

    const pacedTrainLabel =
      selectedPacedTrainIds.length > 0
        ? t('main.pacedTrainCountSelected', {
            count: selectedPacedTrainIds.length,
            totalCount: totalPacedTrainCount,
          })
        : t('main.pacedTrain', { count: totalPacedTrainCount });

    const uniqueTrainLabel =
      selectedUniqueTrainIds.length > 0
        ? t('main.uniqueTrainCountSelected', {
            count: selectedUniqueTrainIds.length,
            totalCount: totalUniqueTrainCount,
          })
        : t('main.uniqueTrain', { count: totalUniqueTrainCount });

    if (totalUniqueTrainCount === 0) {
      return pacedTrainLabel;
    }

    if (totalPacedTrainCount === 0) {
      return uniqueTrainLabel;
    }

    if (selectedUniqueTrainIds.length > 0 || selectedPacedTrainIds.length > 0) {
      return t('main.pacedTrainAndUniqueTrainCount', {
        pacedTrainCount: selectedPacedTrainIds.length,
        totalPacedTrainCount,
        uniqueTrainCount: selectedUniqueTrainIds.length,
        totalUniqueTrainCount,
      });
    }

    return `${pacedTrainLabel}, ${uniqueTrainLabel}`;
  }, [totalUniqueTrainCount, totalPacedTrainCount, selectedUniqueTrainIds, selectedPacedTrainIds]);
  // --- END BOARD WRAPPER TITLE MANAGEMENT ---------------------

  const handleTrainsDelete = async (
    currentSelectedTrainId?: TrainId,
    hideToast: boolean = false
  ) => {
    const trainSchedulesCount = selectedTrainScheduleIds.length;

    const isSelectedTrainScheduleInSelection =
      currentSelectedTrainId !== undefined &&
      selectedTrainScheduleIds.some((trainScheduleId) =>
        currentSelectedTrainId.includes(`${trainScheduleId}`)
      );

    if (isSelectedTrainScheduleInSelection) {
      // we need to clear the selected train, otherwise just after the delete,
      // some unvalid rtk calls are dispatched (see rollingstock request in SimulationResults)
      dispatch(updateSelectedTrain(undefined));
    }

    try {
      if (selectedTrainScheduleIds.length > 0) {
        await deleteTrainSchedules(dispatch, selectedTrainScheduleIds);
      }

      removeTrainSchedules(selectedTrainScheduleIds);

      if (trainSchedules.length - selectedTrainScheduleIds.length === 0) {
        setIsSelectMode(false);
      }

      if (!hideToast) {
        dispatch(
          setSuccess({
            title: t('main.timetable.trainSchedulesSelectionDeletedCount', {
              count: trainSchedulesCount,
            }),
            text: '',
          })
        );
      }
    } catch (e) {
      if (isSelectedTrainScheduleInSelection) {
        dispatch(updateSelectedTrain({ id: currentSelectedTrainId, by: 'timetable' }));
      } else {
        dispatch(setFailure(castErrorToFailure(e)));
      }
    }
  };

  // --- END BOARD WRAPPER MENU ITEMS CONFIGURATION ---

  const handleCopy = useCallback(async () => {
    const selectedText = document.getSelection()?.toString();
    if (selectedText !== undefined && selectedText.length > 0) return;

    if (selectedTrainScheduleIds.length === 0) {
      return;
    }

    await copyTrainSchedulesToClipboard(selectedTrainScheduleIds, trainSchedules);
    dispatch(
      setSuccess({
        title: t('main.copyTimetable.title'),
        text: t('main.copyTimetable.text', { count: selectedTrainScheduleIds.length }),
      })
    );
  }, [selectedTrainScheduleIds, trainSchedules]);

  const handlePaste = useCallback(async () => {
    let data = null;
    const clipboardContent = await navigator.clipboard.readText();
    try {
      data = JSON.parse(clipboardContent);
      const importedPayload = validateTimetableJsonPayload(data);

      const newTrainSchedules = await postFullImportPayload(
        sandboxId,
        scenario.timetable_id,
        scenario.id,
        importedPayload,
        subCategories,
        dispatch,
        t,
        upsertTrainSchedules
      );

      setSelectedTrainScheduleIds(newTrainSchedules.map((train) => train.id));
      dispatch(
        setSuccess({
          title: t('main.pasteTimetable.title'),
          text: t('main.pasteTimetable.text', { count: newTrainSchedules.length }),
        })
      );
    } catch (e) {
      if (data && (data.train_schedules || data.paced_trains)) {
        dispatch(setFailure(castErrorToFailure(e)));
      }
    }
  }, [sandboxId, subCategories]);

  const handleCut = useCallback(
    async (event: ClipboardEvent) => {
      const selectedText = document.getSelection()?.toString();
      if (selectedText !== undefined && selectedText.length > 0) return;

      if (selectedTrainScheduleIds.length === 0) {
        return;
      }

      event.preventDefault();
      await copyTrainSchedulesToClipboard(selectedTrainScheduleIds, trainSchedules);
      await handleTrainsDelete(selectedTrainId, true);
      dispatch(
        setSuccess({
          title: t('main.cutTimetable.title'),
          text: t('main.cutTimetable.text', { count: selectedTrainScheduleIds.length }),
        })
      );
    },
    [selectedTrainScheduleIds, trainSchedules, selectedTrainId]
  );

  const handleDeleteTrainSchedules = () => {
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
    <BoardWrapper withFooter name={computedTrainLabel()} dataTestId="timetable-board-wrapper">
      <Timetable
        selectedTrainScheduleIds={selectedTrainScheduleIds}
        setSelectedTrainScheduleIds={setSelectedTrainScheduleIds}
        isSelectMode={isSelectMode}
        setIsSelectMode={setIsSelectMode}
        setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
        upsertTrainSchedules={upsertTrainSchedules}
        setTrainScheduleToEditData={setTrainScheduleToEditData}
        removeAndUnselectTrains={removeTrainSchedules}
        handleDeleteTrainSchedules={handleDeleteTrainSchedules}
        trainScheduleToEditData={trainScheduleToEditData}
        trainSchedules={trainSchedules}
        trainSchedulesWithDetails={trainSchedulesWithDetails}
        refreshNge={refreshNge}
        projectingOnSimulatedPathException={projectingOnSimulatedPathException}
      />
    </BoardWrapper>
  );
};

export default TimetableBoardWrapper;
