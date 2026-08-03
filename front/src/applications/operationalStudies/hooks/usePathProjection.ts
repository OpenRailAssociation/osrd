import { useEffect, useMemo } from 'react';

import { skipToken } from '@reduxjs/toolkit/query/react';
import type { TFunction } from 'i18next';
import { isEqual, omit } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import {
  osrdEditoastApi,
  type PathfindingResult,
  type OperationalPointReference,
  type TrainScheduleResponse,
} from 'common/api/osrdEditoastApi';
import type { ProjectionWaypoint } from 'modules/simulationResult/types';
import { getExceptionFromOccurrenceId } from 'modules/trainSchedule/helpers/pacedTrain';
import { updateProjectionType } from 'reducers/simulationResults';
import {
  getProjectionType,
  getTrainIdUsedForProjection,
} from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import {
  extractEditoastIdFromTrainScheduleId,
  extractTrainScheduleIdFromOccurrenceId,
  isOccurrenceId,
  isTrainScheduleId,
} from 'utils/trainId';

import type { PathProjectionResult } from '../types';
import { buildPathWaypointsFromRawOPs } from '../utils';

/**
 * Generates a display name for a virtual operational point based on available reference data.
 * Uses trigram --> UIC --> operational_point --> position-based fallbacks in priority order.
 */
const getVirtualOpName = (
  opRef: OperationalPointReference,
  index: number,
  totalCount: number,
  t: TFunction<'operational-studies'>
): string => {
  if (opRef.type === 'trigram') return opRef.trigram;
  if (opRef.type === 'uic') return opRef.uic.toString();
  if (opRef.type === 'id') return t('main.operationalPointReference');
  if (index === 0) return t('main.requestedOrigin');
  if (index === totalCount - 1) return t('main.requestedDestination');
  return t('main.requestedPoint', { count: index + 1 });
};

// Fallback distance between operational points when pathfinding fails (100km in mm)
const FALLBACK_DISTANCE_MM = 100_000_000;

/**
 * Creates a virtual operational point with complete extensions when no infrastructure match is found.
 */
const createVirtualOp = (
  opRef: OperationalPointReference,
  pathItemId: string,
  index: number,
  totalCount: number,
  position: number,
  weight: number,
  t: TFunction<'operational-studies'>
): ProjectionWaypoint => {
  const virtualName = getVirtualOpName(opRef, index, totalCount, t);
  const virtualId = `virtual_op_${pathItemId}`;

  return {
    waypointId: virtualId,
    opId: null,
    pathItemId,
    name: virtualName,
    uic: opRef.type === 'uic' ? opRef.uic : 0,
    secondary_code: (opRef.type !== 'id' && opRef.secondary_code) || null,
    main_code: opRef.type === 'trigram' ? opRef.trigram : '',
    position,
    weight,
    country_code: '??',
    is_passenger_station: false,
    location: {
      type: 'operational_point_part_reference',
      operational_point: opRef,
    },
  };
};

/**
 * Indicates whether two pathfinding results share the same status and simulated path (but not necessarily the same requested path steps).
 * This is useful in particular when projecting on an exception to know whether it shares the same simulated path as its original paced train.
 */
const pathfindingResultsDiffer = (
  pathfinding1: PathfindingResult | undefined,
  pathfinding2: PathfindingResult | undefined
): boolean | undefined => {
  if (!pathfinding1 || !pathfinding2) return undefined;
  if (pathfinding1.status !== pathfinding2.status) return true;
  if (pathfinding1.status !== 'success' || pathfinding2.status !== 'success') return false; // Slightly redundant check to help type narrowing
  return !isEqual(pathfinding1.path, pathfinding2.path);
};

const usePathProjection = (
  infraId: number,
  trainSchedulesById: Map<number, TrainScheduleResponse>
): PathProjectionResult | undefined => {
  const { t } = useTranslation('operational-studies');
  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);
  const projectionType = useSelector(getProjectionType);
  const dispatch = useAppDispatch();

  let rawTrainScheduleId: number | undefined;
  let exceptionId: number | undefined | null;
  if (trainIdUsedForProjection) {
    if (isTrainScheduleId(trainIdUsedForProjection)) {
      rawTrainScheduleId = extractEditoastIdFromTrainScheduleId(trainIdUsedForProjection);
    } else {
      const trainScheduleId = extractTrainScheduleIdFromOccurrenceId(trainIdUsedForProjection);
      rawTrainScheduleId = extractEditoastIdFromTrainScheduleId(trainScheduleId);
      exceptionId = getExceptionFromOccurrenceId(trainSchedulesById, trainIdUsedForProjection)?.id;
    }
  }

  // TODO_EXCEPTION: remove `!` when using TrainSchedulingException type
  const trainScheduleArg = rawTrainScheduleId
    ? { id: rawTrainScheduleId, infraId, exceptionId: exceptionId! }
    : skipToken;
  const baseTrainScheduleArg = exceptionId ? { id: rawTrainScheduleId!, infraId } : skipToken;

  const { data: pathfinding } =
    osrdEditoastApi.endpoints.getTrainSchedulesByIdPath.useQuery(trainScheduleArg);
  const { currentData: baseTrainSchedulePath } =
    osrdEditoastApi.endpoints.getTrainSchedulesByIdPath.useQuery(baseTrainScheduleArg);

  const { data: pathProperties } =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathProperties.useQuery(
      pathfinding?.status === 'success'
        ? {
            infraId,
            pathPropertiesInput: { track_section_ranges: pathfinding.path.track_section_ranges },
          }
        : skipToken
    );

  const projectingOnSimulatedPathException = pathfindingResultsDiffer(
    baseTrainSchedulePath,
    pathfinding
  );

  const pathUsedForProjection = useMemo(() => {
    if (!trainIdUsedForProjection) return undefined;
    if (!isOccurrenceId(trainIdUsedForProjection)) {
      return trainSchedulesById.get(extractEditoastIdFromTrainScheduleId(trainIdUsedForProjection))
        ?.path;
    }
    const trainSchedule = trainSchedulesById.get(
      extractEditoastIdFromTrainScheduleId(
        extractTrainScheduleIdFromOccurrenceId(trainIdUsedForProjection)
      )
    );
    const exception = getExceptionFromOccurrenceId(trainSchedulesById, trainIdUsedForProjection);
    return exception?.path_and_schedule?.path ?? trainSchedule?.path;
  }, [trainIdUsedForProjection, trainSchedulesById]);

  const { opRefs, opRefPathItemIds } = useMemo(() => {
    const refs: OperationalPointReference[] = [];
    const refPathItemIds: string[] = [];
    pathUsedForProjection?.forEach((step) => {
      if (step.location.type === 'operational_point_part_reference') {
        refs.push(step.location.operational_point);
        refPathItemIds.push(step.id);
      }
    });
    return { opRefs: refs, opRefPathItemIds: refPathItemIds };
  }, [pathUsedForProjection]);

  const { data: matchedOperationalPoints } =
    osrdEditoastApi.endpoints.postInfraByInfraIdMatchOperationalPoints.useQuery(
      opRefs.length > 0
        ? {
            infraId,
            body: {
              operational_point_references: opRefs,
            },
          }
        : skipToken
    );

  useEffect(() => {
    if (pathfinding?.status === 'failure' && projectionType === 'trackProjection') {
      dispatch(updateProjectionType('operationalPointProjection'));
    }
  }, [pathfinding, projectionType]);

  return useMemo(() => {
    if (!pathUsedForProjection) {
      return undefined;
    }

    const operationalPointDistances: number[] = [];

    // ===========================
    // SUCCESSFUL PATHFINDING
    // ===========================
    // Use backend-provided operational points with accurate positions and geometry
    if (pathfinding?.status === 'success' && pathProperties) {
      const { operational_points: operationalPoints } = pathProperties;

      const pathfindingOpRefs: OperationalPointReference[] = operationalPoints.map((op) => ({
        operational_point: op.id,
        type: 'id',
      }));

      const formattedOperationalPoints: ProjectionWaypoint[] = buildPathWaypointsFromRawOPs(
        operationalPoints,
        pathUsedForProjection
      ).map((waypoint) => omit(waypoint, 'part'));

      operationalPoints.forEach((op, index) => {
        if (index > 0) {
          operationalPointDistances.push(op.position - operationalPoints[index - 1].position);
        }
      });

      return {
        pathfindingStatus: 'succeeded',
        pathfinding,
        path: pathUsedForProjection,
        geometry: pathProperties.geometry,
        operationalPoints: formattedOperationalPoints,
        operationalPointReferences: pathfindingOpRefs,
        projectingOnSimulatedPathException,
        operationalPointDistances,
      };
    }

    // ===========================
    // FAILED PATHFINDING HANDLING
    // ===========================
    // When pathfinding fails or path properties are unavailable, we still need to display
    // operational points in the manchette and allow projection in the STD
    // Strategy:
    // 1. For each point in the path, try to match with infrastructure data
    // 2. If a point is matched → use matched data with full extensions
    // 3. If a point is not matched (e.g., NGE) → create a virtual point from the reference
    const normalizedOps: ProjectionWaypoint[] = [];

    opRefs.forEach((opRef, index) => {
      const matchedOp = matchedOperationalPoints?.related_operational_points[index];
      const weight = 0; // Uniform weight for consistent manchette spacing
      const position = index * FALLBACK_DISTANCE_MM; // Sequential positioning in manchette
      if (index > 0) {
        operationalPointDistances.push(FALLBACK_DISTANCE_MM); // Add distance for fallback positioning
      }

      const pathItemId = opRefPathItemIds.at(index);
      if (!pathItemId) {
        // We know there are as many opRefPathItemIds as opRefs, so this should never happens
        throw new Error(`Path item ID not found for index ${index}`);
      }

      if (matchedOp) {
        // MATCHED: Point exists in infrastructure
        normalizedOps.push({
          country_code: matchedOp.country_code,
          waypointId: `op-${matchedOp.id}-${position}`,
          opId: matchedOp.id,
          pathItemId,
          is_passenger_station: matchedOp.is_passenger_station,
          main_code: matchedOp.main_code,
          name: matchedOp.name,
          position,
          secondary_code: matchedOp.secondary_code,
          uic: matchedOp.uic,
          weight,
          location: {
            type: 'operational_point_part_reference',
            operational_point: opRef,
          },
        });
      } else {
        // NOT MATCHED: Point doesn't exist in infrastructure (e.g., NGE point)
        // Create virtual point from the reference
        // TODO : change this logic when implementing the non computation creation feature with the new opRef format
        normalizedOps.push(
          createVirtualOp(opRef, pathItemId, index, opRefs.length, position, weight, t)
        );
      }
    });

    return {
      pathfindingStatus: 'failed',
      path: pathUsedForProjection,
      operationalPoints: normalizedOps,
      operationalPointReferences: opRefs,
      operationalPointDistances,
    };
  }, [
    pathfinding,
    pathProperties,
    matchedOperationalPoints,
    pathUsedForProjection,
    projectingOnSimulatedPathException,
  ]);
};

export default usePathProjection;
