import { useMemo } from 'react';

import type { IndividualTrainProjection } from 'modules/simulationResult/types';

const PATH_COLOR_DEFAULT = '#8A714B';

const transformCurve = (
  curve: IndividualTrainProjection['spaceTimeCurves'][0],
  departureTime: Date
) =>
  curve.positions.map((position, i) => ({
    time: curve.times[i] + departureTime.getTime(),
    position,
  }));

const usePaths = (projectPathTrainResult: IndividualTrainProjection[]) =>
  useMemo(
    () =>
      projectPathTrainResult.flatMap((path) =>
        path.spaceTimeCurves.map<{
          id: string;
          label: string;
          points: { time: number; position: number }[];
          color: string;
        }>((spaceTimeCurve) => ({
          id: path.id,
          label: path.name,
          color: PATH_COLOR_DEFAULT,
          points: transformCurve(spaceTimeCurve, path.departureTime),
        }))
      ),
    [projectPathTrainResult]
  );

export default usePaths;
