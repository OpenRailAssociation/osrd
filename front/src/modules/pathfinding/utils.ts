import { compact } from 'lodash';

import type {
  GeoJsonLineString,
  PathProperties,
  PathfindingInputV2,
  PostV2InfraByInfraIdPathfindingBlocksApiArg,
  RollingStockWithLiveries,
} from 'common/api/osrdEditoastApi';
import { getSupportedElectrification, isThermal } from 'modules/rollingStock/helpers/electric';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import type { PathStep } from 'reducers/osrdconf/types';
import { addElementAtIndex } from 'utils/array';
import { getPointCoordinates } from 'utils/geometry';

export const formatSuggestedOperationalPoints = (
  operationalPoints: NonNullable<Required<PathProperties['operational_points']>>,
  geometry: GeoJsonLineString,
  pathLength: number
): SuggestedOP[] =>
  operationalPoints.map((op) => ({
    opId: op.id,
    name: op.extensions?.identifier?.name,
    uic: op.extensions?.identifier?.uic,
    ch: op.extensions?.sncf?.ch,
    kp: op.part.extensions?.sncf?.kp,
    chLongLabel: op.extensions?.sncf?.ch_long_label,
    chShortLabel: op.extensions?.sncf?.ch_short_label,
    ci: op.extensions?.sncf?.ci,
    trigram: op.extensions?.sncf?.trigram,
    offsetOnTrack: op.part.position,
    track: op.part.track,
    positionOnPath: op.position,
    coordinates: getPointCoordinates(geometry, pathLength, op.position),
  }));

export const matchPathStepAndOp = (step: PathStep, op: SuggestedOP) => {
  if ('operational_point' in step) {
    return step.operational_point === op.opId;
  }
  // We match the kp in case two OPs have the same uic+ch (can happen when the
  // infra is imported)
  if ('uic' in step) {
    return step.uic === op.uic && step.ch === op.ch && step.kp === op.kp;
  }
  if ('trigram' in step) {
    return step.trigram === op.trigram && step.ch === op.ch && step.kp === op.kp;
  }
  // TODO: we abuse the PathStep.id field here, the backend also sets it to an
  // ID which has nothing to do with OPs
  return step.id === op.opId;
};

export const getPathfindingQuery = ({
  infraId,
  rollingStock,
  origin,
  destination,
  pathSteps,
}: {
  infraId?: number;
  rollingStock?: RollingStockWithLiveries;
  origin: PathStep | null;
  destination: PathStep | null;
  pathSteps: (PathStep | null)[];
}): PostV2InfraByInfraIdPathfindingBlocksApiArg | null => {
  if (infraId && rollingStock && origin && destination) {
    // Only origin and destination can be null so we can compact and we want to remove any via that would be null
    const pathItems: PathfindingInputV2['path_items'] = compact(pathSteps).map((step) => {
      if ('uic' in step) {
        return { uic: step.uic, secondary_code: step.ch };
      }
      if ('track' in step) {
        return {
          track: step.track,
          // TODO: step offset should be in mm in the store /!\
          // pathfinding blocks endpoint requires offsets in mm
          offset: step.offset * 1000,
        };
      }
      if ('operational_point' in step) {
        return {
          operational_point: step.operational_point,
        };
      }
      return {
        trigram: step.trigram,
      };
    });

    return {
      infraId,
      pathfindingInputV2: {
        path_items: pathItems,
        rolling_stock_is_thermal: isThermal(rollingStock.effort_curves.modes),
        rolling_stock_loading_gauge: rollingStock.loading_gauge,
        rolling_stock_supported_electrifications: getSupportedElectrification(
          rollingStock.effort_curves.modes
        ),
        rolling_stock_supported_signaling_systems: rollingStock.supported_signaling_systems,
        rolling_stock_maximum_speed: rollingStock.max_speed,
        rolling_stock_length: rollingStock.length,
      },
    };
  }
  return null;
};

export const upsertPathStepsInOPs = (ops: SuggestedOP[], pathSteps: PathStep[]): SuggestedOP[] => {
  let updatedOPs = [...ops];
  pathSteps.forEach((step) => {
    const { stopFor, arrival, onStopSignal, theoreticalMargin } = step;
    // We check only for pathSteps added by map click
    if ('track' in step) {
      const formattedStep: SuggestedOP = {
        opId: step.id,
        positionOnPath: step.positionOnPath!,
        offsetOnTrack: step.offset,
        track: step.track,
        coordinates: step.coordinates,
        stopFor,
        arrival,
        onStopSignal,
        theoreticalMargin,
      };
      // If it hasn't an uic, the step has been added by map click,
      // we know we have its position on path so we can insert it
      // at the good index in the existing operational points
      const index = updatedOPs.findIndex(
        (op) => step.positionOnPath !== undefined && op.positionOnPath >= step.positionOnPath
      );

      // if index === -1, it means that the position on path of the last step is bigger
      // than the last operationnal point position.
      // So we know this pathStep is the destination and we want to add it at the end of the array.
      if (index !== -1) {
        updatedOPs = addElementAtIndex(updatedOPs, index, formattedStep);
      } else {
        updatedOPs.push(formattedStep);
      }
    } else if ('uic' in step) {
      updatedOPs = updatedOPs.map((op) => {
        if (op.uic === step.uic && op.ch === step.ch && op.kp === step.kp) {
          return {
            ...op,
            stopFor,
            arrival,
            onStopSignal,
            theoreticalMargin,
          };
        }
        return op;
      });
    }
  });
  return updatedOPs;
};

/**
 * Check if a suggested operational point is a via.
 * Some OPs have same uic so we need to check also the ch (can be still not enough
 * probably because of imports problem).
 * If the vias has no uic, it has been added via map click and we know it has an id.
 * @param withKP - If true, we check the kp compatibility instead of the name.
 * It is used in the times and stops table to check if an operational point is a via.
 */
export const isVia = (vias: PathStep[], op: SuggestedOP, withKP = false) =>
  vias.some(
    (via) =>
      ('uic' in via &&
        'ch' in via &&
        via.uic === op.uic &&
        via.ch === op.ch &&
        (withKP ? via.kp === op.kp : via.name === op.name)) ||
      via.id === op.opId
  );
