import { useEffect, useMemo } from 'react';

import { skipToken } from '@reduxjs/toolkit/query/react';
import type { TFunction } from 'i18next';
import { isEqual } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import {
  osrdEditoastApi,
  type PathfindingResult,
  type OperationalPointPartReference,
  type PathProperties,
  type OperationalPointIdentifier,
} from 'common/api/osrdEditoastApi';
import { getExceptionFromOccurrenceId } from 'modules/timetableItem/helpers/pacedTrain';
import type { TimetableItemId, TimetableItem } from 'reducers/osrdconf/types';
import { updateProjectionType } from 'reducers/simulationResults';
import {
  getProjectionType,
  getTrainIdUsedForProjection,
} from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import { formatUicToCi } from 'utils/strings';
import {
  extractEditoastIdFromPacedTrainId,
  extractEditoastIdFromTrainScheduleId,
  extractPacedTrainIdFromOccurrenceId,
  isOccurrenceId,
  isPacedTrainId,
  isTrainScheduleId,
} from 'utils/trainId';

import type { PathProjectionResult } from '../types';
import { getStationFromOps } from '../utils';

/**
 * Generates a display name for a virtual operational point based on available reference data.
 * Uses trigram --> UIC --> operational_point --> position-based fallbacks in priority order.
 */
const getVirtualOpName = (
  opId: OperationalPointIdentifier,
  index: number,
  totalCount: number,
  t: TFunction<'operational-studies'>
): string => {
  if (opId.type === 'trigram') return opId.trigram;
  if (opId.type === 'uic') return opId.uic.toString();
  if (opId.type === 'id') return t('main.operationalPointIdentifier');
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
  opId: OperationalPointIdentifier,
  index: number,
  totalCount: number,
  position: number,
  weight: number,
  t: TFunction<'operational-studies'>
): PathProperties['operational_points'][0] => {
  const virtualName = getVirtualOpName(opId, index, totalCount, t);
  const virtualId = `virtual_op_${virtualName}`;

  return {
    id: virtualId,
    extensions: {
      identifier: {
        name: virtualName,
        uic: opId.type === 'uic' ? opId.uic : 0,
      },
      sncf: {
        ch: (opId.type !== 'id' && opId.secondary_code) || '',
        ch_long_label: '',
        ch_short_label: '',
        ci: opId.type === 'uic' ? Number(formatUicToCi(opId.uic)) : 0,
        trigram: opId.type === 'trigram' ? opId.trigram : '',
      },
    },
    part: { track: '', position: 0 },
    position,
    weight,
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
  timetableItemsById: Map<TimetableItemId, TimetableItem>
): PathProjectionResult | undefined => {
  const { t } = useTranslation('operational-studies');
  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);
  const projectionType = useSelector(getProjectionType);
  const dispatch = useAppDispatch();

  let rawTrainScheduleId: number | undefined;
  let rawPacedTrainId: number | undefined;
  let exceptionKey: string | undefined;
  if (trainIdUsedForProjection) {
    if (isTrainScheduleId(trainIdUsedForProjection)) {
      rawTrainScheduleId = extractEditoastIdFromTrainScheduleId(trainIdUsedForProjection);
    } else if (isPacedTrainId(trainIdUsedForProjection)) {
      rawPacedTrainId = extractEditoastIdFromPacedTrainId(trainIdUsedForProjection);
    } else {
      const pacedTrainId = extractPacedTrainIdFromOccurrenceId(trainIdUsedForProjection);
      rawPacedTrainId = extractEditoastIdFromPacedTrainId(pacedTrainId);
      exceptionKey = getExceptionFromOccurrenceId(
        timetableItemsById,
        trainIdUsedForProjection
      )?.key;
    }
  }

  const scheduleArg = rawTrainScheduleId ? { id: rawTrainScheduleId, infraId } : skipToken;
  const pacedArg = rawPacedTrainId ? { id: rawPacedTrainId, infraId, exceptionKey } : skipToken;
  const basePacedArg = exceptionKey ? { id: rawPacedTrainId!, infraId } : skipToken;

  const { data: schedulePath } =
    osrdEditoastApi.endpoints.getTrainScheduleByIdPath.useQuery(scheduleArg);
  const { data: pacedPath } = osrdEditoastApi.endpoints.getPacedTrainByIdPath.useQuery(pacedArg);
  const { currentData: basePacedPath } =
    osrdEditoastApi.endpoints.getPacedTrainByIdPath.useQuery(basePacedArg);

  const pathfinding = rawTrainScheduleId ? schedulePath : pacedPath;

  const { data: pathProperties } =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathProperties.useQuery(
      pathfinding?.status === 'success'
        ? {
            infraId,
            pathPropertiesInput: { track_section_ranges: pathfinding.path.track_section_ranges },
          }
        : skipToken
    );

  const projectingOnSimulatedPathException = pathfindingResultsDiffer(basePacedPath, pacedPath);

  const pathUsedForProjection = useMemo(() => {
    if (!trainIdUsedForProjection) return undefined;
    if (!isOccurrenceId(trainIdUsedForProjection)) {
      return timetableItemsById.get(trainIdUsedForProjection)?.path;
    }
    const pacedTrain = timetableItemsById.get(
      extractPacedTrainIdFromOccurrenceId(trainIdUsedForProjection)
    );
    const exception = getExceptionFromOccurrenceId(timetableItemsById, trainIdUsedForProjection);
    return exception?.path_and_schedule?.path ?? pacedTrain!.path;
  }, [trainIdUsedForProjection, timetableItemsById]);

  const opPartRefs = useMemo(() => {
    const refs: OperationalPointPartReference[] = [];
    pathUsedForProjection?.forEach((step) => {
      if ('operational_point' in step.location) {
        refs.push({ operational_point: step.location.operational_point });
      }
    });
    return refs;
  }, [pathUsedForProjection]);

  const { data: matchedOperationalPoints } =
    osrdEditoastApi.endpoints.postInfraByInfraIdMatchOperationalPoints.useQuery(
      opPartRefs.length > 0
        ? {
            infraId,
            body: {
              operational_point_part_references: opPartRefs,
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

      const pathfindingOpRefs: OperationalPointPartReference[] = [];
      operationalPoints.forEach((op, index) => {
        pathfindingOpRefs.push({
          operational_point: { operational_point: op.id, type: 'id' },
        });
        if (index > 0) {
          operationalPointDistances.push(op.position - operationalPoints[index - 1].position);
        }
      });

      return {
        pathfindingStatus: 'succeeded',
        pathfinding,
        path: pathUsedForProjection,
        geometry: pathProperties.geometry,
        operationalPoints,
        operationalPointPartReferences: pathfindingOpRefs,
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
    const normalizedOps: PathProperties['operational_points'] = [];

    opPartRefs.forEach((opPartRef, index) => {
      const matchedOps = matchedOperationalPoints?.related_operational_points[index] || [];
      const matchedOp = getStationFromOps(matchedOps);
      const weight = 0; // Uniform weight for consistent manchette spacing
      const position = index * FALLBACK_DISTANCE_MM; // Sequential positioning in manchette
      if (index > 0) {
        operationalPointDistances.push(FALLBACK_DISTANCE_MM); // Add distance for fallback positioning
      }

      if (matchedOp) {
        // MATCHED: Point exists in infrastructure
        normalizedOps.push({
          id: matchedOp.id,
          extensions: matchedOp.extensions,
          part: matchedOp.parts.at(0) || { track: '', position: 0, extensions: undefined },
          position,
          weight,
        });
      } else {
        // NOT MATCHED: Point doesn't exist in infrastructure (e.g., NGE point)
        // Create virtual point from the reference
        normalizedOps.push(
          createVirtualOp(
            opPartRef.operational_point,
            index,
            opPartRefs.length,
            position,
            weight,
            t
          )
        );
      }
    });

    return {
      pathfindingStatus: 'failed',
      path: pathUsedForProjection,
      operationalPoints: normalizedOps,
      operationalPointPartReferences: opPartRefs,
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
