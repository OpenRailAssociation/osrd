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
    chLongLabel: op.extensions?.sncf?.ch_long_label,
    chShortLabel: op.extensions?.sncf?.ch_short_label,
    ci: op.extensions?.sncf?.ci,
    trigram: op.extensions?.sncf?.trigram,
    offsetOnTrack: op.part.position,
    track: op.part.track,
    positionOnPath: op.position,
    coordinates: getPointCoordinates(geometry, pathLength, op.position),
  }));

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
    // Only origin and destination can be null so we can compact
    const pathItems: PathfindingInputV2['path_items'] = compact(pathSteps).map((step) => {
      if ('uic' in step) {
        return { uic: step.uic, secondary_code: step.ch };
      }
      if ('track' in step) {
        return {
          track: step.track,
          offset: step.offset,
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
      },
    };
  }
  return null;
};

export const insertViasInOPs = (ops: SuggestedOP[], pathSteps: PathStep[]): SuggestedOP[] => {
  let updatedOPs = [...ops];
  const vias = pathSteps.slice(1, -1);
  if (vias.length > 0) {
    vias.forEach((step) => {
      // We check only for vias added by map click
      if ('track' in step) {
        const formattedStep: SuggestedOP = {
          opId: step.id,
          positionOnPath: step.positionOnPath!,
          offsetOnTrack: step.offset,
          track: step.track,
          coordinates: step.coordinates,
        };
        // If it hasn't an uic, the step has been added by map click,
        // we know we have its position on path so we can insert it
        // at the good index in the existing operational points
        const index = updatedOPs.findIndex(
          (op) => step.positionOnPath && op.positionOnPath >= step.positionOnPath
        );
        updatedOPs = addElementAtIndex(updatedOPs, index, formattedStep);
      }
    });
  }
  return updatedOPs;
};

/**
 * Check if a suggested operational point is a via.
 * Some OPs have same uic so we need to check also the ch (can be still not enough
 * probably because of imports problem).
 * If the vias has no uic, it has been added via map click and we know it has an id.
 */
export const isVia = (vias: PathStep[], op: SuggestedOP) =>
  vias.some(
    (via) =>
      ('uic' in via && 'ch' in via && via.uic === op.uic && via.ch === op.ch) || via.id === op.opId
  );
