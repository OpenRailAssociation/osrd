import { useEffect, useState } from 'react';

import { useSelector } from 'react-redux';

import {
  osrdEditoastApi,
  type InfraWithState,
  type PathfindingResult,
  type PathfindingResultSuccess,
  type PathProperties,
} from 'common/api/osrdEditoastApi';
import { getTrainIdUsedForProjection } from 'reducers/simulationResults/selectors';
import {
  formatPacedTrainIdToEditoastTrainId,
  extractEditoastIdFromTrainScheduleId,
  isTrainScheduleId,
} from 'utils/trainId';

const usePathProjection = (infra: InfraWithState) => {
  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);
  const [pathUsedForProjection, setPathUsedForProjection] = useState<{
    path: PathfindingResultSuccess;
    geometry: PathProperties['geometry'];
  }>();

  const [getTrainSchedulePath] = osrdEditoastApi.endpoints.getTrainScheduleByIdPath.useLazyQuery();
  const [getPacedTrainPath] = osrdEditoastApi.endpoints.getPacedTrainByIdPath.useLazyQuery();
  const [postPathProperties] =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathProperties.useLazyQuery();

  useEffect(() => {
    const fetchPathUsedForProjection = async () => {
      if (!trainIdUsedForProjection) return;

      let path: PathfindingResult;
      if (isTrainScheduleId(trainIdUsedForProjection)) {
        path = await getTrainSchedulePath({
          id: extractEditoastIdFromTrainScheduleId(trainIdUsedForProjection),
          infraId: infra.id,
        }).unwrap();
      } else {
        path = await getPacedTrainPath({
          id: formatPacedTrainIdToEditoastTrainId(trainIdUsedForProjection),
          infraId: infra.id,
        }).unwrap();
      }

      if (path.status !== 'success') return;

      const pathProperties = await postPathProperties({
        infraId: infra.id,
        props: ['geometry'],
        pathPropertiesInput: {
          track_section_ranges: path.track_section_ranges,
        },
      }).unwrap();

      setPathUsedForProjection({
        path,
        geometry: pathProperties.geometry,
      });
    };

    fetchPathUsedForProjection();
  }, [trainIdUsedForProjection]);

  return pathUsedForProjection;
};

export default usePathProjection;
