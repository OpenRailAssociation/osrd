import type { TrainSpaceTimeData } from 'modules/simulationResult/types';
import type { TrainId, TimetableItemId } from 'reducers/osrdconf/types';
import { extractPacedTrainIdFromOccurrenceId, isOccurrenceId } from 'utils/trainId';

export default function createHandleTrainDrag({
  projectPathTrainResult,
  setProjectPathTrainResult,
  handleTrainDragInTrackOccupancy,
  updateTrainDepartureTime,
}: {
  projectPathTrainResult: TrainSpaceTimeData[];
  setProjectPathTrainResult: (value: TrainSpaceTimeData[]) => void;
  handleTrainDragInTrackOccupancy: (args: {
    draggedTrainId: TrainId;
    newTrainData: TrainSpaceTimeData;
    initialDepartureTime: Date;
    stopPanning: boolean;
  }) => Promise<void>;
  updateTrainDepartureTime: (trainId: TimetableItemId, newDepartureTime: Date) => Promise<void>;
}) {
  return async function handleTrainDrag({
    draggedTrainId,
    newDepartureTime,
    initialDepartureTime,
    stopPanning,
  }: {
    draggedTrainId: TrainId;
    newDepartureTime: Date;
    initialDepartureTime: Date;
    stopPanning: boolean;
  }) {
    const draggedTrain = projectPathTrainResult.find((train) => train.id === draggedTrainId);
    if (!draggedTrain) return;

    const newTrainData = { ...draggedTrain, departureTime: newDepartureTime };

    // Handle updating track occupancy data (with no distant update yet, so with stopPanning: false)
    await handleTrainDragInTrackOccupancy({
      draggedTrainId,
      stopPanning: false,
      initialDepartureTime,
      newTrainData,
    });

    if (stopPanning) {
      // update in the database
      const draggedItemId = !isOccurrenceId(draggedTrainId)
        ? draggedTrainId
        : extractPacedTrainIdFromOccurrenceId(draggedTrainId);
      await updateTrainDepartureTime(draggedItemId, newDepartureTime);

      // Handle retrieving track occupancy data from server (so with stopPanning: true):
      await handleTrainDragInTrackOccupancy({
        draggedTrainId,
        stopPanning: true,
        initialDepartureTime,
        newTrainData,
      });
    } else {
      // update in the state
      setProjectPathTrainResult(
        projectPathTrainResult.map((train) => (train.id === draggedTrainId ? newTrainData : train))
      );
    }
  };
}
