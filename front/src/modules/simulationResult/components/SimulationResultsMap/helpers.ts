import along from '@turf/along';
import { lineString } from '@turf/helpers';
import type { Feature, LineString } from 'geojson';

import type { PositionSpeedTime, PositionsSpeedTimes } from 'reducers/osrdsimulation/types';

import type { TrainPosition } from './types';

// TODO: fix warped map - check if this is the correct data type to use
// type InterpolatedTrain = {
//   name: string;
//   id: number;
//   trainId: number;
//   head_positions?: PositionSpeedTime;
//   tail_positions?: PositionSpeedTime;
//   speeds?: PositionSpeedTime;
// };

function getPosition(positionValues: PositionsSpeedTimes<Date>, baseKey?: string) {
  const key = baseKey as keyof PositionsSpeedTimes<Date>;
  return positionValues[key] as PositionSpeedTime<Date>;
}

// TODO: fix warped map - probably remove this function and use finalOutput as key ?
export function getRegimeKey() {
  return 'base';
}

export function getSimulationHoverPositions(
  geojsonPath: Feature<LineString>,
  // TODO: fix warped map - check if this is the correct data to use
  // simulation: SimulationResponseSuccess,
  // timePosition: Date,
  positionValues: PositionsSpeedTimes<Date>,
  selectedTrainId?: number
) {
  const line = lineString(geojsonPath.geometry.coordinates);
  const positions: (TrainPosition & { isSelected?: boolean })[] = [];

  if (selectedTrainId) {
    // TODO: fix warped map - check if we need to adapt these values with tsv2 datas
    const headPositionRaw = getPosition(positionValues, 'headPosition');
    const tailPositionRaw = getPosition(positionValues, 'tailPosition');

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

  // TODO: fix warped map - uncomment and adapt all the rest of the funtion

  // Found trains including timePosition, and organize them with geojson collection of points
  // const actualTime = datetime2sec(timePosition);

  // First find trains where actual time from position is between start & stop

  // const concernedTrains: InterpolatedTrain[] = [];
  // const baseOrEco = getRegimeKey();
  // const trainRegime = simulation.final_output;
  // if (
  //   trainRegime &&
  //   trainRegime.head_positions.length > 0 &&
  //   trainRegime.head_positions[0].length > 0
  // ) {
  //   const trainTime = trainRegime.head_positions[0][0].time;
  //   const train2ndTime = last(last(trainRegime.head_positions))?.time as number;
  //   if (actualTime >= trainTime && actualTime <= train2ndTime && train.id !== selectedTrainId) {
  //     const interpolation = interpolateOnTime(
  //       trainRegime,
  //       CHART_AXES.SPACE_TIME,
  //       LIST_VALUES.REGIME
  //     )(timePosition) as Record<string, PositionSpeedTime<Date>>;
  //     if (interpolation.head_positions && interpolation.speeds) {
  //       concernedTrains.push({
  //         ...interpolation,
  //         name: train.name,
  //         id: idx,
  //         trainId: train.id,
  //       });
  //     }
  //   }
  // }
  // positions = positions.concat(
  //   concernedTrains.map((train) => {
  //     const headDistanceAlong = (train.head_positions?.position ?? 0) / 1000;
  //     const tailDistanceAlong = (train.tail_positions?.position ?? 0) / 1000;
  //     const headPosition = along(line, headDistanceAlong, {
  //       units: 'kilometers',
  //     });
  //     const tailPosition = train.tail_positions
  //       ? along(line, tailDistanceAlong, { units: 'kilometers' })
  //       : headPosition;
  //     const trainLength = Math.abs(headDistanceAlong - tailDistanceAlong);
  //     return {
  //       id: `other-train-${train.id}`,
  //       trainId: train.id,
  //       headPosition,
  //       tailPosition,
  //       headDistanceAlong,
  //       tailDistanceAlong,
  //       speedTime: {
  //         speed: train.speeds?.speed || positionValues.speed.speed,
  //         time: positionValues?.speed?.time,
  //       },
  //       trainLength,
  //     };
  //   })
  // );

  return positions;
}
