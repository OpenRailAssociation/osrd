import { useMemo } from 'react';

import { skipToken } from '@reduxjs/toolkit/query';
import { useSelector } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { TimetableItemWithDetails } from 'modules/timetableItem/types';
import type { PacedTrainId } from 'reducers/osrdconf/types';
import { getProjectionType, getIsSimulationEnabled } from 'reducers/simulationResults/selectors';
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
 * For trains with 'scheduleNotHonored', or invalid simulations, makes an API call with use_simulation: false
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
  const projectionType = useSelector(getProjectionType);
  const isSimulationEnabled = useSelector(getIsSimulationEnabled);

  const { invalidTrainIds, invalidExceptionKeys, invalidBaseTrains } = useMemo(() => {
    if (!isSimulationEnabled || projectionType !== 'operationalPointProjection')
      return {
        invalidTrainIds: new Set<PacedTrainId>(),
        invalidExceptionKeys: new Map(),
        invalidBaseTrains: new Set(),
      };

    const projectionIds = new Set(projections.map((p) => p.id));
    const invalidIds = new Set<PacedTrainId>();
    const invalidExceptions = new Map<PacedTrainId, Set<string>>();
    const invalidBases = new Set<PacedTrainId>();

    timetableItemsWithDetails.forEach((train) => {
      if (!projectionIds.has(train.id)) return;

      const isBaseInvalid =
        !train.summary?.isValid || train.summary.notHonoredReason === 'scheduleNotHonored';

      if (isBaseInvalid) {
        invalidIds.add(train.id);
        invalidBases.add(train.id);
      }

      const invalidKeys = new Set<string>();
      train.paced?.exceptions.forEach((exception) => {
        if (
          !exception.summary?.isValid ||
          exception.summary.notHonoredReason === 'scheduleNotHonored'
        ) {
          invalidKeys.add(exception.key);
        }
      });

      if (invalidKeys.size > 0) {
        invalidExceptions.set(train.id, invalidKeys);
        if (!isBaseInvalid) invalidIds.add(train.id);
      }
    });

    return {
      invalidTrainIds: invalidIds,
      invalidExceptionKeys: invalidExceptions,
      invalidBaseTrains: invalidBases,
    };
  }, [isSimulationEnabled, projectionType, timetableItemsWithDetails, projections]);

  const shouldSkip =
    invalidTrainIds.size === 0 ||
    !projectionData?.operationalPointReferences?.length ||
    !projectionData?.operationalPointDistances?.length;

  const editoastIds = useMemo(
    () => Array.from(invalidTrainIds).map(extractEditoastIdFromPacedTrainId),
    [invalidTrainIds]
  );

  const { currentData: linearProjections } =
    osrdEditoastApi.endpoints.postPacedTrainProjectPathOp.useQuery(
      shouldSkip || !projectionData
        ? skipToken
        : {
            body: {
              infra_id: infraId,
              train_ids: editoastIds,
              operational_points_refs: projectionData.operationalPointReferences,
              operational_points_distances: projectionData.operationalPointDistances,
              use_simulation: false,
            },
          }
    );

  return useMemo(() => {
    if (!linearProjections || Object.keys(linearProjections).length === 0) return projections;

    const projectionsMap = new Map(projections.map((p) => [p.id, p]));

    for (const [editoastId, projectionResult] of Object.entries(linearProjections)) {
      const pacedTrainId = formatEditoastIdToPacedTrainId(Number(editoastId));
      const existingProjection = projectionsMap.get(pacedTrainId);
      if (!existingProjection) continue;

      const isBaseInvalid = invalidBaseTrains.has(pacedTrainId);
      const invalidKeys = invalidExceptionKeys.get(pacedTrainId);

      const updatedProjection = { ...existingProjection };

      if (isBaseInvalid) {
        updatedProjection.spaceTimeCurves = projectionResult.paced_train;
        updatedProjection.signalUpdates = [];
        updatedProjection.isInvalid = true;
      }

      if (invalidKeys && invalidKeys.size > 0 && existingProjection.paced?.exceptionProjections) {
        const updatedExceptions = new Map(existingProjection.paced.exceptionProjections);

        for (const exceptionKey of invalidKeys) {
          if (projectionResult.exceptions[exceptionKey]) {
            updatedExceptions.set(exceptionKey, {
              spaceTimeCurves: projectionResult.exceptions[exceptionKey],
              signalUpdates: [],
              isInvalid: true,
            });
          }
        }

        updatedProjection.paced = {
          ...existingProjection.paced,
          exceptionProjections: updatedExceptions,
        };
      }

      projectionsMap.set(pacedTrainId, updatedProjection);
    }

    return [...projectionsMap.values()];
  }, [linearProjections, projections, invalidExceptionKeys, invalidBaseTrains]);
};

export default useHandleInvalidProjections;
