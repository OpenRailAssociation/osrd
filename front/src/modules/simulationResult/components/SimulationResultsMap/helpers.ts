import along from '@turf/along';
import { lineString } from '@turf/helpers';
import type { Feature, LineString } from 'geojson';
import { last } from 'lodash';

import { CHART_AXES, LIST_VALUES } from 'modules/simulationResult/consts';
import { interpolateOnTime } from 'modules/simulationResult/components/ChartHelpers/ChartHelpers';
import {
  type AllowancesSettings,
  type PositionSpeedTime,
  type SimulationSnapshot,
  type PositionsSpeedTimes,
} from 'reducers/osrdsimulation/types';
import { datetime2sec } from 'utils/timeManipulation';
import type { TrainPosition } from './types';

type InterpolatedTrain = {
  name: string;
  id: number;
  trainId: number;
  head_positions?: PositionSpeedTime;
  tail_positions?: PositionSpeedTime;
  speeds?: PositionSpeedTime;
};

function getPosition(
  positionValues: PositionsSpeedTimes<Date>,
  allowancesSettings?: AllowancesSettings,
  trainId?: number,
  baseKey?: string
) {
  const key = (
    allowancesSettings && trainId && allowancesSettings[trainId]?.ecoBlocks
      ? `eco_${baseKey}`
      : baseKey
  ) as keyof PositionsSpeedTimes<Date>;
  return positionValues[key] as PositionSpeedTime<Date>;
}

export function getRegimeKey(trainId: number, allowancesSettings?: AllowancesSettings) {
  return allowancesSettings && allowancesSettings[trainId]?.ecoBlocks ? 'eco' : 'base';
}

export function getSimulationHoverPositions(
  geojsonPath: Feature<LineString>,
  simulation: SimulationSnapshot,
  timePosition: Date,
  positionValues: PositionsSpeedTimes<Date>,
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
    if (headPositionRaw?.position && tailPositionRaw?.position) {
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
  const actualTime = datetime2sec(timePosition);

  // First find trains where actual time from position is between start & stop
  const concernedTrains: InterpolatedTrain[] = [];
  simulation.trains.forEach((train, idx: number) => {
    const baseOrEco = getRegimeKey(train.id);
    const trainRegime = train[baseOrEco];
    if (
      trainRegime &&
      trainRegime.head_positions.length > 0 &&
      trainRegime.head_positions[0].length > 0
    ) {
      const trainTime = trainRegime.head_positions[0][0].time;
      const train2ndTime = last(last(trainRegime.head_positions))?.time as number;
      if (actualTime >= trainTime && actualTime <= train2ndTime && train.id !== selectedTrainId) {
        const interpolation = interpolateOnTime(
          trainRegime,
          CHART_AXES.SPACE_TIME,
          LIST_VALUES.REGIME
        )(timePosition) as Record<string, PositionSpeedTime<Date>>;
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
