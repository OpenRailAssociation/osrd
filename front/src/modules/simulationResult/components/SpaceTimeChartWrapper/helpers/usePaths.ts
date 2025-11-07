import type { IndividualTrainProjection } from 'modules/simulationResult/types';

const PATH_COLOR_DEFAULT = '#8A714B';

const formatSpaceTimeCurves = (individualTrainProjections: IndividualTrainProjection[]) =>
  individualTrainProjections.flatMap((train) =>
    train.spaceTimeCurves.map<{
      id: string;
      label: string;
      points: { time: number; position: number }[];
      color: string;
    }>((spaceTimeCurve) => ({
      id: train.id,
      label: train.name,
      color: PATH_COLOR_DEFAULT,
      points: spaceTimeCurve.positions.map((position, i) => ({
        time: spaceTimeCurve.times[i] + train.departureTime.getTime(),
        position,
      })),
    }))
  );

export default formatSpaceTimeCurves;
