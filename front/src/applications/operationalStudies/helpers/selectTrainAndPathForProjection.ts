const selectTrainAndPathForProjection = (
  trainIds: number[],
  updateSelectedTrainId: (trainId: number) => void,
  updateTrainIdUsedForProjection: (trainId: number) => void,
  currentProjection?: number,
  selectedTrainId?: number
) => {
  if (trainIds.length === 0) {
    return;
  }

  // if a selected train is given, we use it for the projection
  if (selectedTrainId && !currentProjection && trainIds.includes(selectedTrainId)) {
    updateTrainIdUsedForProjection(selectedTrainId);
    return;
  }

  // if there is already a projection and the projected train still exists, keep it
  if (currentProjection && trainIds.includes(currentProjection)) {
    if (!selectedTrainId) updateSelectedTrainId(trainIds[0]);
    return;
  }

  // by default, use the first train
  updateTrainIdUsedForProjection(trainIds[0]);
  updateSelectedTrainId(trainIds[0]);
};

export default selectTrainAndPathForProjection;
