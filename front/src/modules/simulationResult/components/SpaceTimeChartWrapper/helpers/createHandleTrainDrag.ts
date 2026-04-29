import type { TrainSpaceTimeData } from 'modules/simulationResult/types';
import type { TrainId } from 'reducers/osrdconf/types';
import {
  extractEditoastIdFromPacedTrainId,
  extractPacedTrainIdFromOccurrenceId,
  isOccurrenceId,
} from 'utils/trainId';

export default function createHandleTrainDrag({
  trainScheduleProjections,
  setTrainScheduleProjections,
  handleTrainDragInTrackOccupancy,
  updateTrainScheduleDepartureTime,
}: {
  trainScheduleProjections: TrainSpaceTimeData[];
  setTrainScheduleProjections: (newProjections: TrainSpaceTimeData[]) => void;
  handleTrainDragInTrackOccupancy: (args: {
    draggedTrainId: TrainId;
    newTrainData: TrainSpaceTimeData;
    initialDepartureTime: Date;
    stopPanning: boolean;
  }) => Promise<void>;
  updateTrainScheduleDepartureTime: (
    trainScheduleId: number,
    newDepartureTime: Date
  ) => Promise<void>;
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
    const draggedItemId = extractEditoastIdFromPacedTrainId(
      isOccurrenceId(draggedTrainId)
        ? extractPacedTrainIdFromOccurrenceId(draggedTrainId)
        : draggedTrainId
    );
    const draggedTrain = trainScheduleProjections.find((train) => train.id === draggedItemId);
    if (!draggedTrain) return;

    const newTrainData = {
      ...draggedTrain,
      departureTime: newDepartureTime,
    };

    // Handle updating track occupancy data (with no distant update yet, so with stopPanning: false)
    await handleTrainDragInTrackOccupancy({
      draggedTrainId,
      stopPanning: false,
      initialDepartureTime,
      newTrainData,
    });

    if (!stopPanning) {
      // update in the state
      setTrainScheduleProjections(
        trainScheduleProjections.map((train) => (train.id === draggedItemId ? newTrainData : train))
      );
      return;
    }

    await updateTrainScheduleDepartureTime(draggedItemId, newDepartureTime);

    // Handle retrieving track occupancy data from server (so with stopPanning: true):
    await handleTrainDragInTrackOccupancy({
      draggedTrainId,
      stopPanning: true,
      initialDepartureTime,
      newTrainData,
    });
  };
}
