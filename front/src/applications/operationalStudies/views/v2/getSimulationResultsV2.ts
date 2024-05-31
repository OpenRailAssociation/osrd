import type { TrainSpaceTimeData } from 'applications/operationalStudies/types';
import { formatSpaceTimeData } from 'applications/operationalStudies/utils';
import { enhancedEditoastApi } from 'common/api/enhancedEditoastApi';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import i18n from 'i18n';
import { setFailure } from 'reducers/main';
import {
  updateIsUpdating,
  updateTrainIdUsedForProjection,
  updateSelectedTrainId,
} from 'reducers/osrdsimulation/actions';
import { store } from 'store';
import { replaceElementAtIndex } from 'utils/array';
import { castErrorToFailure } from 'utils/error';

export const selectProjectionV2 = (
  trainIds: number[],
  currentProjection?: number,
  selectedTrainId?: number
) => {
  if (trainIds.length === 0) return;

  if (selectedTrainId && !currentProjection) {
    // if a selected train is given, we use it for the projection
    if (trainIds.includes(selectedTrainId)) {
      store.dispatch(updateTrainIdUsedForProjection(selectedTrainId));
      return;
    }
  }

  // if there is already a projection
  if (currentProjection) {
    // if the projected train still exists, keep it
    if (trainIds.includes(currentProjection)) {
      if (!selectedTrainId) store.dispatch(updateSelectedTrainId(trainIds[0]));
      return;
    }
  }

  // by default, use the first train
  store.dispatch(updateTrainIdUsedForProjection(trainIds[0]));
  store.dispatch(updateSelectedTrainId(trainIds[0]));
};

export const getSpaceTimeChartData = async (
  trainSchedulesIDs: number[],
  trainIdUsedForProjection: number,
  infraId: number,
  setSpaceTimeData: React.Dispatch<React.SetStateAction<TrainSpaceTimeData[]>>
) => {
  if (trainSchedulesIDs.length > 0) {
    store.dispatch(updateIsUpdating(true));
    try {
      // We fetch the pathfinding result from the train with the selected projection
      const { data: pathfindingResult } = await store.dispatch(
        osrdEditoastApi.endpoints.getV2TrainScheduleByIdPath.initiate({
          id: trainIdUsedForProjection,
          infraId,
        })
      );

      const { data: trainSchedules } = await store.dispatch(
        osrdEditoastApi.endpoints.getV2TrainSchedule.initiate({ ids: trainSchedulesIDs })
      );

      if (pathfindingResult && pathfindingResult.status === 'success' && trainSchedules) {
        const { blocks, routes, track_section_ranges } = pathfindingResult;
        const projectPathTrainResult = await store
          .dispatch(
            enhancedEditoastApi.endpoints.postV2TrainScheduleProjectPath.initiate({
              infra: infraId,
              ids: trainSchedulesIDs,
              projectPathInput: { blocks, routes, track_section_ranges },
            })
          )
          .unwrap();

        setSpaceTimeData((prevTrains) => {
          let newSpaceTimeData = [...prevTrains];

          // For each key (train id) in projectPathTrainResult, we either add it or update it in the state
          Object.keys(projectPathTrainResult).forEach((trainId) => {
            const currentProjectedTrain = projectPathTrainResult[trainId];

            const matchingTrain = trainSchedules.find((train) => train.id === +trainId);

            const formattedProjectedPathTrainResult = formatSpaceTimeData(
              trainId,
              currentProjectedTrain,
              matchingTrain?.train_name
            );

            const foundTrainIndex = newSpaceTimeData.findIndex(
              (train) => train.id.toString() === trainId
            );
            if (foundTrainIndex !== -1) {
              newSpaceTimeData = replaceElementAtIndex(
                newSpaceTimeData,
                foundTrainIndex,
                formattedProjectedPathTrainResult
              );
            } else {
              newSpaceTimeData.push(formattedProjectedPathTrainResult);
            }
          });

          return newSpaceTimeData;
        });
      }
    } catch (e) {
      store.dispatch(
        setFailure(
          castErrorToFailure(e, {
            name: i18n.t('simulation:errorMessages.unableToRetrieveTrainSchedule'),
          })
        )
      );
    } finally {
      store.dispatch(updateIsUpdating(false));
    }
  } else {
    store.dispatch(updateSelectedTrainId(undefined));
    store.dispatch(updateTrainIdUsedForProjection(undefined));
  }
};
