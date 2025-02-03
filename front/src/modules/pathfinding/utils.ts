import { compact } from 'lodash';

import type {
  GeoJsonLineString,
  PathItemLocation,
  PathProperties,
  PathfindingInput,
  PostInfraByInfraIdPathfindingBlocksApiArg,
  RollingStockWithLiveries,
} from 'common/api/osrdEditoastApi';
import { getSupportedElectrification, isThermal } from 'modules/rollingStock/helpers/electric';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import type { PathStep } from 'reducers/osrdconf/types';
import { addElementAtIndex } from 'utils/array';
import { getPointOnTrackCoordinates } from 'utils/geometry';

import getStepLocation from './helpers/getStepLocation';

export const formatSuggestedOperationalPoints = (
  operationalPoints: Array<
    NonNullable<Required<PathProperties['operational_points']>>[number] & {
      metadata?: NonNullable<SuggestedOP['metadata']>;
    }
  >,
  geometry: GeoJsonLineString,
  pathLength: number
): SuggestedOP[] =>
  operationalPoints.map((op) => ({
    opId: op.id,
    name: op.extensions?.identifier?.name,
    uic: op.extensions?.identifier?.uic,
    ch: op.extensions?.sncf?.ch,
    kp: op.part.extensions?.sncf?.kp,
    trigram: op.extensions?.sncf?.trigram,
    offsetOnTrack: op.part.position,
    track: op.part.track,
    positionOnPath: op.position,
    coordinates: getPointOnTrackCoordinates(geometry, pathLength, op.position),
    metadata: op?.metadata,
  }));

export const matchPathStepAndOp = (
  step: PathItemLocation,
  op: Pick<SuggestedOP, 'opId' | 'uic' | 'ch' | 'trigram' | 'track' | 'offsetOnTrack'>
) => {
  if ('operational_point' in step) {
    return step.operational_point === op.opId;
  }
  if ('uic' in step) {
    return step.uic === op.uic && step.secondary_code === op.ch;
  }
  if ('trigram' in step) {
    return step.trigram === op.trigram && step.secondary_code === op.ch;
  }
  return step.track === op.track && step.offset === op.offsetOnTrack;
};

export const getPathfindingQuery = ({
  infraId,
  rollingStock,
  pathSteps,
}: {
  infraId?: number;
  rollingStock?: RollingStockWithLiveries;
  pathSteps: (PathItemLocation | null)[];
}): PostInfraByInfraIdPathfindingBlocksApiArg | null => {
  const origin = pathSteps.at(0);
  const destination = pathSteps.at(-1);
  if (infraId && rollingStock && origin && destination) {
    // Only origin and destination can be null so we can compact and we want to remove any via that would be null
    const pathItems: PathfindingInput['path_items'] = compact(pathSteps).map((step) =>
      getStepLocation(step)
    );

    return {
      infraId,
      pathfindingInput: {
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
    const { arrival, stopFor, receptionSignal, theoreticalMargin } = step;
    // We check only for pathSteps added by map click
    if ('track' in step) {
      const formattedStep: SuggestedOP = {
        pathStepId: step.id,
        positionOnPath: step.positionOnPath!,
        offsetOnTrack: step.offset,
        track: step.track,
        coordinates: step.coordinates,
        stopFor,
        arrival,
        receptionSignal,
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
    } else {
      updatedOPs = updatedOPs.map((op) => {
        if (
          matchPathStepAndOp(step, op) &&
          op.kp === step.kp &&
          step.positionOnPath === op.positionOnPath
        ) {
          return {
            ...op,
            pathStepId: step.id,
            stopFor,
            arrival,
            receptionSignal,
            theoreticalMargin,
          };
        }
        return op;
      });
    }
  });
  return updatedOPs;
};

export const pathStepMatchesOp = (
  pathStep: PathStep,
  op: Pick<
    SuggestedOP,
    'pathStepId' | 'opId' | 'uic' | 'ch' | 'trigram' | 'track' | 'offsetOnTrack' | 'name' | 'kp'
  >,
  withKP = false
) => {
  if (!matchPathStepAndOp(pathStep, op)) {
    return pathStep.id === op.pathStepId;
  }
  if ('uic' in pathStep) {
    return withKP ? pathStep.kp === op.kp : pathStep.name === op.name;
  }
  return true;
};

/**
 * Check if a suggested operational point is a via.
 * Some OPs have same uic so we need to check also the ch (can be still not enough
 * probably because of imports problem).
 * If the vias has no uic, it has been added via map click and we know it has an id.
 * @param withKP - If true, we check the kp compatibility instead of the name.
 * It is used in the times and stops table to check if an operational point is a via.
 */
export const isVia = (
  vias: PathStep[],
  op: Pick<
    SuggestedOP,
    'pathStepId' | 'opId' | 'uic' | 'ch' | 'trigram' | 'track' | 'offsetOnTrack' | 'name' | 'kp'
  >,
  { withKP = false } = {}
) => vias.some((via) => pathStepMatchesOp(via, op, withKP));

export const isStation = (chCode: string): boolean =>
  chCode === 'BV' || chCode === '00' || chCode === '';

export const isPathStepInvalid = (step: PathStep | null): boolean => step?.isInvalid || false;
