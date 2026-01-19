import type { TrainSpaceTimeData } from 'modules/simulationResult/types';
import type { TrainId, TimetableItemId } from 'reducers/osrdconf/types';
import { extractPacedTrainIdFromOccurrenceId, isOccurrenceId } from 'utils/trainId';

export default function createHandleTrainDrag({
  timetableItemProjections,
  setTimetableItemProjections,
  handleTrainDragInTrackOccupancy,
  updateTrainDepartureTime,
}: {
  timetableItemProjections: TrainSpaceTimeData[];
  setTimetableItemProjections: (newProjections: TrainSpaceTimeData[]) => void;
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
    const trainToDragId = isOccurrenceId(draggedTrainId)
      ? extractPacedTrainIdFromOccurrenceId(draggedTrainId)
      : draggedTrainId;

    const draggedTrain = timetableItemProjections.find((train) => train.id === trainToDragId);
    if (!draggedTrain) return;

    const newTrainData = {
      ...draggedTrain,
      departureTime: newDepartureTime,
    };

    // Handle updating track occupancy data (with no distant update yet, so with stopPanning: false)
    await handleTrainDragInTrackOccupancy({
      draggedTrainId: trainToDragId,
      stopPanning: false,
      initialDepartureTime,
      newTrainData,
    });

    if (!stopPanning) {
      // update in the state
      setTimetableItemProjections(
        timetableItemProjections.map((train) => (train.id === trainToDragId ? newTrainData : train))
      );
      return;
    }

    await updateTrainDepartureTime(trainToDragId, newDepartureTime);

    // Handle retrieving track occupancy data from server (so with stopPanning: true):
    await handleTrainDragInTrackOccupancy({
      draggedTrainId: trainToDragId,
      stopPanning: true,
      initialDepartureTime,
      newTrainData,
    });
  };
}
