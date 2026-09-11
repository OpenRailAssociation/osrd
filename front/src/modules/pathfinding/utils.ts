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
