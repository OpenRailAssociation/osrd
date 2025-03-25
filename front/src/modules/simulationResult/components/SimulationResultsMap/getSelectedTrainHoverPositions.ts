import along from '@turf/along';
import { lineString } from '@turf/helpers';
import type { Feature, LineString } from 'geojson';
import { max, min } from 'lodash';

import type { TimetableItemCurrentInfo } from 'common/Map/components/TrainOnMap/TrainOnMap';
import type { TimetableItemId } from 'reducers/osrdconf/types';
import type { PositionsSpeedTimes } from 'reducers/simulationResults/types';
import { mToKm } from 'utils/physics';

const getSelectedTrainHoverPositions = (
  geojsonPath: Feature<LineString>,
  positionValues: PositionsSpeedTimes<Date>,
  timetableItemId: TimetableItemId
): TimetableItemCurrentInfo | undefined => {
  const { headPosition, tailPosition } = positionValues;

  if (headPosition === undefined || tailPosition === undefined) {
    return undefined;
  }

  const headDistanceAlong = mToKm(headPosition.position);
  const tailDistanceAlong = mToKm(tailPosition.position);

  const line = lineString(geojsonPath.geometry.coordinates);
  const headPositionPoint = along(line, headDistanceAlong, {
    units: 'kilometers',
  });

  return {
    timetableItemId,
    headPositionCoord: headPositionPoint.geometry.coordinates,
    headDistanceAlong: max([headDistanceAlong, tailDistanceAlong])!,
    tailDistanceAlong: min([headDistanceAlong, tailDistanceAlong])!,
    speed: positionValues.speed.speed,
    time: positionValues.speed.time,
  };
};

export default getSelectedTrainHoverPositions;
