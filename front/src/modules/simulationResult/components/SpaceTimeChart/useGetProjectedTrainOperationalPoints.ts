import { useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';

import { STDCM_TRAIN_ID } from 'applications/stdcm/consts';
import {
  osrdEditoastApi,
  type PathProperties,
  type TrainScheduleResult,
} from 'common/api/osrdEditoastApi';
import { addElementAtIndex } from 'utils/array';

const useGetProjectedTrainOperationalPoints = (
  trainScheduleUsedForProjection?: TrainScheduleResult,
  trainIdUsedForProjection?: number,
  infraId?: number
) => {
  const { t } = useTranslation('simulation');
  const [operationalPoints, setOperationalPoints] = useState<
    NonNullable<PathProperties['operational_points']>
  >([]);

  const { data: pathfindingResult } = osrdEditoastApi.endpoints.getTrainScheduleByIdPath.useQuery(
    {
      id: trainIdUsedForProjection!,
      infraId: infraId!,
    },
    {
      skip: !trainIdUsedForProjection || !infraId || trainIdUsedForProjection === STDCM_TRAIN_ID,
    }
  );

  const [postPathProperties] =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathProperties.useMutation();

  useEffect(() => {
    const getOperationalPoints = async () => {
      if (infraId && trainScheduleUsedForProjection && pathfindingResult?.status === 'success') {
        const { operational_points } = await postPathProperties({
          infraId,
          props: ['operational_points'],
          pathPropertiesInput: {
            track_section_ranges: pathfindingResult.track_section_ranges,
          },
        }).unwrap();

        let operationalPointsWithAllWaypoints = operational_points!;

        // Check if there are vias added by map click and insert them in the operational points
        let waypointCounter = 1;

        trainScheduleUsedForProjection.path.forEach((step, i) => {
          if (!('track' in step)) return;

          const positionOnPath = pathfindingResult.path_item_positions[i];
          const indexToInsert = operationalPointsWithAllWaypoints.findIndex(
            (op) => op.position >= positionOnPath
          );

          const formattedStep: NonNullable<PathProperties['operational_points']>[number] = {
            id: step.id,
            extensions: {
              identifier: {
                name: t('requestedPoint', { count: waypointCounter }),
                uic: 0,
              },
            },
            part: { track: step.track, position: step.offset },
            position: positionOnPath,
          };

          waypointCounter += 1;

          // If we can't find any op position greater than the current step position, we add it at the end
          if (indexToInsert === -1) {
            operationalPointsWithAllWaypoints.push(formattedStep);
            return;
          }

          operationalPointsWithAllWaypoints = addElementAtIndex(
            operationalPointsWithAllWaypoints,
            indexToInsert,
            formattedStep
          );
        });

        setOperationalPoints(operationalPointsWithAllWaypoints);
      }
    };
    getOperationalPoints();
  }, [pathfindingResult, infraId, t]);

  return operationalPoints;
};

export default useGetProjectedTrainOperationalPoints;
