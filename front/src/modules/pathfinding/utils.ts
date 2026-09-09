import type { TFunction } from 'i18next';
import { compact } from 'lodash';

import type {
  GeoJsonLineString,
  LightRollingStock,
  LoadingGaugeType,
  PathItemLocation,
  PathProperties,
  PathfindingInput,
  PathfindingItem,
  PostInfraByInfraIdPathfindingBlocksApiArg,
} from 'common/api/osrdEditoastApi';
import { getSupportedElectrification, isThermal } from 'modules/rollingStock/helpers/electric';
import type { SuggestedOP } from 'modules/trainSchedule/types';
import type { PathStep } from 'reducers/osrdconf/types';
import { addElementAtIndex } from 'utils/array';
import { getPointOnTrackCoordinates } from 'utils/geometry';
import { mToMm } from 'utils/physics';

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
    pathStepId: undefined,
    name: op.name,
    uic: op.uic,
    secondaryCode: op.secondary_code,
    countryCode: op.country_code,
    kp: op.part.extensions?.sncf?.kp,
    mainCode: op.main_code,
    isPassengerStation: op.is_passenger_station,
    offsetOnTrack: op.part.position,
    track: op.part.track,
    trackName: op.part.local_track_name,
    positionOnPath: op.position,
    coordinates: getPointOnTrackCoordinates(geometry, pathLength, op.position)!,
    metadata: op?.metadata,
  }));

export const matchPathStepAndOp = (
  step: PathItemLocation,
  op: Pick<
    SuggestedOP,
    'opId' | 'uic' | 'secondaryCode' | 'mainCode' | 'track' | 'offsetOnTrack' | 'countryCode'
  >
) => {
  if (step.type === 'track_offset') {
    return step.track === op.track && step.offset === op.offsetOnTrack;
  }
  if (step.operational_point.type === 'id') {
    return step.operational_point.operational_point === op.opId;
  }
  if (step.operational_point.type === 'uic') {
    return (
      step.operational_point.uic === op.uic &&
      step.operational_point.secondary_code === op.secondaryCode
    );
  }
  return (
    step.operational_point.main_code === op.mainCode &&
    step.operational_point.secondary_code === op.secondaryCode &&
    step.operational_point.country_code === op.countryCode
  );
};

export const getPathfindingQuery = ({
  infraId,
  rollingStock,
  pathSteps,
  loadingGauge,
  speedLimitByTag,
  allowedTrackSections,
}: {
  infraId?: number;
  rollingStock?: Pick<
    LightRollingStock,
    'effort_curves' | 'loading_gauge' | 'max_speed' | 'length' | 'supported_signaling_systems'
  >;
  pathSteps: (PathfindingItem | null)[];
  loadingGauge?: LoadingGaugeType;
  speedLimitByTag?: string | null;
  allowedTrackSections?: string[];
}): PostInfraByInfraIdPathfindingBlocksApiArg | null => {
  const origin = pathSteps.at(0);
  const destination = pathSteps.at(-1);
  if (infraId && rollingStock && origin && destination) {
    // Only origin and destination can be null so we can compact and we want to remove any via that would be null
    const pathItems: PathfindingInput['path_items'] = compact(pathSteps);

    return {
      infraId,
      pathfindingInput: {
        path_items: pathItems,
        rolling_stock_is_thermal: isThermal(rollingStock.effort_curves.modes),
        rolling_stock_loading_gauge: loadingGauge ?? rollingStock.loading_gauge,
        rolling_stock_supported_electrifications: getSupportedElectrification(
          rollingStock.effort_curves.modes
        ),
        rolling_stock_supported_signaling_systems: rollingStock.supported_signaling_systems.map(
          (s) => s.type
        ),
        rolling_stock_maximum_speed: rollingStock.max_speed,
        rolling_stock_length: Math.round(mToMm(rollingStock.length)),
        speed_limit_tag: speedLimitByTag,
        allowed_track_sections: allowedTrackSections,
      },
    };
  }
  return null;
};

export const isPathStepInvalid = (step: PathStep | null): boolean => step?.isInvalid || false;

export const upsertPathStepsInOPs = (
  ops: SuggestedOP[],
  pathSteps: PathStep[],
  t: TFunction<'operational-studies'>
): SuggestedOP[] => {
  let updatedOPs = [...ops];
  pathSteps.forEach((step, stepIndex) => {
    if (isPathStepInvalid(step)) return;
    const { arrival, stopFor, receptionSignal, theoreticalMargin } = step;
    // We check only for pathSteps added by map click
    if (step.location.type === 'track_offset') {
      let stepName = t('main.requestedPoint', { count: stepIndex });
      if (stepIndex === 0) {
        stepName = t('main.requestedOrigin');
      } else if (stepIndex === pathSteps.length - 1) {
        stepName = t('main.requestedDestination');
      }
      const formattedStep: SuggestedOP = {
        pathStepId: step.id,
        opId: undefined,
        positionOnPath: step.positionOnPath!,
        offsetOnTrack: step.location.offset,
        track: step.location.track,
        coordinates: step.coordinates,
        stopFor,
        arrival,
        receptionSignal,
        theoreticalMargin,
        name: stepName,
      };
      // If it hasn't an uic, the step has been added by map click,
      // we know we have its position on path so we can insert it
      // at the good index in the existing operational points
      const index = updatedOPs.findIndex(
        (op) => step.positionOnPath !== undefined && op.positionOnPath >= step.positionOnPath
      );

      // if index === -1, it means that the position on path of the last step is bigger
      // than the last operational point position.
      // So we know this pathStep is the destination and we want to add it at the end of the array.
      if (index !== -1) {
        updatedOPs = addElementAtIndex(updatedOPs, index, formattedStep);
      } else {
        updatedOPs.push(formattedStep);
      }
    } else {
      const index = updatedOPs.findIndex(
        (op) => matchPathStepAndOp(step.location, op) && step.positionOnPath === op.positionOnPath
      );
      if (index < 0) {
        throw new Error(`Could not find path step "${step.id}" in OP list`);
      }
      updatedOPs[index] = {
        ...updatedOPs[index],
        pathStepId: step.id,
        stopFor,
        arrival,
        receptionSignal,
        theoreticalMargin,
      };
    }
  });
  return updatedOPs;
};

export const pathStepMatchesOp = (
  pathStep: PathStep,
  op: Pick<
    SuggestedOP,
    | 'pathStepId'
    | 'opId'
    | 'uic'
    | 'secondaryCode'
    | 'countryCode'
    | 'mainCode'
    | 'track'
    | 'offsetOnTrack'
    | 'name'
    | 'kp'
  >,
  withKP = false
) => {
  if (!matchPathStepAndOp(pathStep.location, op)) {
    return pathStep.id === op.pathStepId;
  }
  if (
    pathStep.location.type === 'operational_point_part_reference' &&
    pathStep.location.operational_point.type === 'uic'
  ) {
    return withKP ? pathStep.kp === op.kp : pathStep.name === op.name;
  }
  return true;
};

/**
 * Check if a suggested operational point is a via.
 * Some OPs have same uic so we need to check also the secondary code (can be still not enough
 * probably because of imports problem).
 * If the vias has no uic, it has been added via map click and we know it has an id.
 * @param withKP - If true, we check the kp compatibility instead of the name.
 * It is used in the times and stops table to check if an operational point is a via.
 */
export const isVia = (
  vias: PathStep[],
  op: Pick<
    SuggestedOP,
    | 'pathStepId'
    | 'opId'
    | 'uic'
    | 'secondaryCode'
    | 'countryCode'
    | 'mainCode'
    | 'track'
    | 'offsetOnTrack'
    | 'name'
    | 'kp'
  >,
  { withKP = false } = {}
) => vias.some((via) => pathStepMatchesOp(via, op, withKP));
