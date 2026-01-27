import { useEffect, useMemo, useState } from 'react';

import { useSelector } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { TimetableItemWithDetails } from 'modules/timetableItem/types';
import { getProjectionType } from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import { extractEditoastIdFromPacedTrainId, formatEditoastIdToPacedTrainId } from 'utils/trainId';

import type { ProjectionData, TrainSpaceTimeData } from '../../types';

type UseHandleInvalidProjectionsOptions = {
  infraId: number;
  projectionData: ProjectionData | undefined;
  timetableItemsWithDetails: TimetableItemWithDetails[];
  projections: TrainSpaceTimeData[];
};

/**
 * Hook that handles display of trains with invalid simulations.
 * For trains with 'scheduleNotHonored', makes an API call with use_simulation: false
 * to get linear (input-only) curves instead of invalid simulation curves.
 *
 * Only applies this logic in 'operationalPointProjection' mode.
 */
const useHandleInvalidProjections = ({
  infraId,
  projectionData,
  timetableItemsWithDetails,
  projections,
}: UseHandleInvalidProjectionsOptions): TrainSpaceTimeData[] => {
  const dispatch = useAppDispatch();
  const projectionType = useSelector(getProjectionType);

  const invalidTrainIds = useMemo(() => {
    if (projectionType !== 'operationalPointProjection') return [];

    const projectionIds = new Set(projections.map((p) => p.id));

    return timetableItemsWithDetails
      .filter(
        (train) =>
          train.summary?.isValid === true &&
          train.summary.notHonoredReason === 'scheduleNotHonored' &&
          projectionIds.has(train.id)
      )
      .map((train) => train.id);
  }, [projectionType, timetableItemsWithDetails, projections]);

  const shouldSkip =
    invalidTrainIds.length === 0 ||
    !projectionData?.operationalPointReferences?.length ||
    !projectionData?.operationalPointDistances?.length;

  const [linearProjections, setLinearProjections] = useState<
    Record<string, { paced_train: TrainSpaceTimeData['spaceTimeCurves'] }>
  >({});

  useEffect(() => {
    if (shouldSkip) {
      setLinearProjections({});
      return;
    }

    const editoastIds = invalidTrainIds.map(extractEditoastIdFromPacedTrainId);

    dispatch(
      osrdEditoastApi.endpoints.postPacedTrainProjectPathOp.initiate(
        {
          body: {
            infra_id: infraId,
            train_ids: editoastIds,
            operational_points_refs: projectionData.operationalPointReferences,
            operational_points_distances: projectionData.operationalPointDistances,
            use_simulation: false,
          },
        },
        { subscribe: false }
      )
    )
      .unwrap()
      .then(setLinearProjections)
      .catch((error) => {
        console.error('Error re-projecting invalid trains:', error);
        setLinearProjections({});
      });
  }, [dispatch, infraId, shouldSkip, invalidTrainIds, projectionData]);

  return useMemo(() => {
    if (Object.keys(linearProjections).length === 0) return projections;

    const projectionsMap = new Map(projections.map((p) => [p.id, p]));
    const overrides = new Map<string, TrainSpaceTimeData>();

    for (const [editoastId, projectionResult] of Object.entries(linearProjections)) {
      const pacedTrainId = formatEditoastIdToPacedTrainId(Number(editoastId));
      const existingProjection = projectionsMap.get(pacedTrainId);

      if (existingProjection) {
        overrides.set(pacedTrainId, {
          ...existingProjection,
          spaceTimeCurves: projectionResult.paced_train,
          signalUpdates: [],
        });
      }
    }

    return projections.map((proj) => overrides.get(proj.id) ?? proj);
  }, [linearProjections, projections]);
};

export default useHandleInvalidProjections;
