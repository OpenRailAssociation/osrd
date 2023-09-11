import along from '@turf/along';
import { lineString } from '@turf/helpers';
import { Feature, LineString } from 'geojson';
import { last } from 'lodash';

import {
  AllowancesSettings,
  PositionSpeedTime,
  PositionValues,
  SimulationSnapshot,
} from 'reducers/osrdsimulation/types';
import { datetime2sec, timeString2datetime } from 'utils/timeManipulation';
import { interpolateOnTime } from 'modules/simulationResult/components/ChartHelpers/ChartHelpers';
import { TrainPosition } from './types';

export type InterpoledTrain = {
  name: string;
  id: number;
  trainId: number;
  head_positions?: PositionSpeedTime;
  tail_positions?: PositionSpeedTime;
  speeds?: PositionSpeedTime;
};

export function getPosition(
  positionValues: PositionValues,
  allowancesSettings?: AllowancesSettings,
  trainId?: number,
  baseKey?: string
) {
  const key = (
    allowancesSettings && trainId && allowancesSettings[trainId]?.ecoBlocks
      ? `eco_${baseKey}`
      : baseKey
  ) as keyof PositionValues;
  return positionValues[key] as PositionSpeedTime;
}

export function getRegimeKey(trainId: number, allowancesSettings?: AllowancesSettings) {
  return allowancesSettings && allowancesSettings[trainId]?.ecoBlocks ? 'eco' : 'base';
}

export function getSimulationHoverPositions(
  geojsonPath: Feature<LineString>,
  simulation: SimulationSnapshot,
  timePosition: string,
  positionValues: PositionValues,
  selectedTrainId?: number,
  allowancesSettings?: AllowancesSettings
) {
  const line = lineString(geojsonPath.geometry.coordinates);
  let positions: (TrainPosition & { isSelected?: boolean })[] = [];

  if (selectedTrainId) {
    const headPositionRaw = getPosition(
      positionValues,
      allowancesSettings,
      selectedTrainId,
      'headPosition'
    );
    const tailPositionRaw = getPosition(
      positionValues,
      allowancesSettings,
      selectedTrainId,
      'tailPosition'
    );
    if (headPositionRaw) {
      const headDistanceAlong = headPositionRaw.position / 1000;
      const tailDistanceAlong = tailPositionRaw.position / 1000;
      const headPosition = along(line, headDistanceAlong, {
        units: 'kilometers',
      });
      const tailPosition = tailPositionRaw
        ? along(line, tailDistanceAlong, { units: 'kilometers' })
        : headPosition;
      const trainLength = Math.abs(headDistanceAlong - tailDistanceAlong);
      positions.push({
        id: 'main-train',
        trainId: selectedTrainId,
        headPosition,
        tailPosition,
        headDistanceAlong,
        tailDistanceAlong,
        speedTime: positionValues.speed,
        trainLength,
        isSelected: true,
      });
    }
  }

  // Found trains including timePosition, and organize them with geojson collection of points
  const timePositionDate = timeString2datetime(timePosition) || new Date(timePosition);
  let actualTime = 0;
  if (timePositionDate instanceof Date) {
    actualTime = datetime2sec(timePositionDate);
  } else {
    console.warn('Try to create Other Train Point from unspecified current time Position');
    return [];
  }

  // First find trains where actual time from position is between start & stop
  const concernedTrains: InterpoledTrain[] = [];
  simulation.trains.forEach((train, idx: number) => {
    const baseOrEco = getRegimeKey(train.id);
    const trainRegime = train[baseOrEco];
    if (trainRegime && trainRegime.head_positions[0]) {
      const trainTime = trainRegime.head_positions[0][0].time;
      const train2ndTime = last(last(trainRegime.head_positions))?.time as number;
      if (actualTime >= trainTime && actualTime <= train2ndTime && train.id !== selectedTrainId) {
        const interpolation = interpolateOnTime(
          train[baseOrEco],
          ['time', 'position'],
          ['head_positions', 'tail_positions', 'speeds'],
          actualTime
        ) as Record<string, PositionSpeedTime>;
        if (interpolation.head_positions && interpolation.speeds) {
          concernedTrains.push({
            ...interpolation,
            name: train.name,
            id: idx,
            trainId: train.id,
          });
        }
      }
    }
  });
  positions = positions.concat(
    concernedTrains.map((train) => {
      const headDistanceAlong = (train.head_positions?.position ?? 0) / 1000;
      const tailDistanceAlong = (train.tail_positions?.position ?? 0) / 1000;
      const headPosition = along(line, headDistanceAlong, {
        units: 'kilometers',
      });
      const tailPosition = train.tail_positions
        ? along(line, tailDistanceAlong, { units: 'kilometers' })
        : headPosition;
      const trainLength = Math.abs(headDistanceAlong - tailDistanceAlong);
      return {
        id: `other-train-${train.id}`,
        trainId: train.id,
        headPosition,
        tailPosition,
        headDistanceAlong,
        tailDistanceAlong,
        speedTime: {
          speed: train.speeds?.speed || positionValues.speed.speed,
          time: positionValues?.speed?.time,
        },
        trainLength,
      };
    })
  );

  return positions;
}
