import { useEffect } from 'react';

import { type Position } from 'geojson';

import {
  osrdEditoastApi,
  type PostInfraByInfraIdPathPropertiesApiArg,
  type PostInfraByInfraIdPathfindingBlocksApiArg,
  type RollingStockWithLiveries,
  type TrainScheduleResult,
  type PathfindingResult,
  type SearchResultItemOperationalPoint,
} from 'common/api/osrdEditoastApi';
import buildOpSearchQuery from 'modules/operationalPoint/helpers/buildOpSearchQuery';
import { formatSuggestedOperationalPoints, matchPathStepAndOp } from 'modules/pathfinding/utils';
import { getSupportedElectrification, isThermal } from 'modules/rollingStock/helpers/electric';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import computeBasePathStep from 'modules/trainschedule/helpers/computeBasePathStep';
import { setFailure } from 'reducers/main';
import { updatePathSteps } from 'reducers/osrdconf/operationalStudiesConf';
import type { PathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';
import { getPointCoordinates } from 'utils/geometry';

import type { ManageTrainSchedulePathProperties } from '../types';
import { useManageTrainScheduleContext } from './useManageTrainScheduleContext';
import { useScenarioContext } from './useScenarioContext';

type ItineraryForTrainUpdate = {
  pathSteps: (PathStep | null)[];
  pathProperties: ManageTrainSchedulePathProperties;
};

export function updatePathStepsFromOperationalPoints(
  pathSteps: PathStep[],
  suggestedOperationalPoints: SuggestedOP[],
  pathfindingResult: Extract<PathfindingResult, { status: 'success' }>,
  stepsCoordinates: Position[]
) {
  const updatedPathSteps: PathStep[] = pathSteps.map((step, i) => {
    const correspondingOp = suggestedOperationalPoints.find((suggestedOp) =>
      matchPathStepAndOp(step, suggestedOp)
    );

    const { kp, name } = correspondingOp || step;

    return {
      ...step,
      ...(correspondingOp && { secondary_code: correspondingOp.ch }),
      kp,
      name,
      positionOnPath: pathfindingResult.path_item_positions[i],
      coordinates: stepsCoordinates[i],
    };
  });
  return updatedPathSteps;
}

const useSetupItineraryForTrainUpdate = (trainIdToEdit: number) => {
  const dispatch = useAppDispatch();
  const { setPathProperties } = useManageTrainScheduleContext();

  const { infraId, getTrackSectionsByIds } = useScenarioContext();

  const [getTrainScheduleById] = osrdEditoastApi.endpoints.getTrainScheduleById.useLazyQuery({});
  const [getRollingStockByName] =
    osrdEditoastApi.endpoints.getRollingStockNameByRollingStockName.useLazyQuery();
  const [postPathfindingBlocks] =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathfindingBlocks.useLazyQuery();
  const [postPathProperties] =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathProperties.useLazyQuery();
  const [postSearch] = osrdEditoastApi.endpoints.postSearch.useMutation();

  useEffect(() => {
    const fetchPathStepsCoordinates = async (trainSchedule: TrainScheduleResult) => {
      // get track sections
      const trackSectionIds: string[] = [];
      trainSchedule.path.forEach((step) => {
        if ('track' in step) {
          trackSectionIds.push(step.track);
        }
      });
      const tracks = await getTrackSectionsByIds(trackSectionIds);

      // get operational points
      const searchPayload = buildOpSearchQuery(infraId, [trainSchedule]);
      const ops = searchPayload
        ? ((await postSearch({
            searchPayload,
            pageSize: 1000,
          }).unwrap()) as SearchResultItemOperationalPoint[])
        : [];

      // match path steps with track sections or operational points
      const pathStepsWithCoordinates = trainSchedule.path.map((step, index) => {
        let coordinates: Position | undefined;
        let name: string | undefined;

        if ('track' in step) {
          const track = tracks[step.track];
          if (track) {
            coordinates = getPointCoordinates(track.geo, track.length, step.offset);
          }
        } else {
          let op: SearchResultItemOperationalPoint | undefined;
          if ('uic' in step) {
            op = ops.find((o) => o.uic === step.uic);
          } else if ('trigram' in step) {
            op = ops.find((o) => o.trigram === step.trigram);
          } else {
            op = ops.find((o) => o.obj_id === step.operational_point);
          }
          coordinates = op?.geographic.coordinates;
          name = `${op?.name}`;
        }

        return {
          ...computeBasePathStep(trainSchedule, index),
          coordinates,
          name,
        };
      });

      dispatch(updatePathSteps(pathStepsWithCoordinates));
    };

    const computeItineraryForTrainUpdate = async (
      trainSchedule: TrainScheduleResult,
      rollingStock: RollingStockWithLiveries
    ): Promise<ItineraryForTrainUpdate | null> => {
      if (!infraId) {
        return null;
      }

      // TODO TS2 : Next part might not be needed (except to updePathSteps), we need inly trainSchedulePath and
      // rolling stock infos to relaunch the pathfinding. Check for that in simulation results issue
      const params: PostInfraByInfraIdPathfindingBlocksApiArg = {
        infraId,
        pathfindingInput: {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          path_items: trainSchedule.path.map(({ id, deleted, ...item }) => item),
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
      const pathfindingResult = await postPathfindingBlocks(params).unwrap();
      if (pathfindingResult.status !== 'success') {
        fetchPathStepsCoordinates(trainSchedule);
        return null;
      }
      const pathPropertiesParams: PostInfraByInfraIdPathPropertiesApiArg = {
        infraId,
        props: ['electrifications', 'geometry', 'operational_points'],
        pathPropertiesInput: {
          track_section_ranges: pathfindingResult.track_section_ranges,
        },
      };
      const { electrifications, geometry, operational_points } =
        await postPathProperties(pathPropertiesParams).unwrap();
      if (!electrifications || !geometry || !operational_points) {
        return null;
      }
      const stepsCoordinates = pathfindingResult.path_item_positions.map((position) =>
        getPointCoordinates(geometry, pathfindingResult.length, position)
      );
      const suggestedOperationalPoints: SuggestedOP[] = formatSuggestedOperationalPoints(
        operational_points,
        geometry,
        pathfindingResult.length
      );

      const computedpathSteps = trainSchedule.path.map((_, index) =>
        computeBasePathStep(trainSchedule, index)
      );
      const updatedPathSteps: PathStep[] = updatePathStepsFromOperationalPoints(
        computedpathSteps,
        suggestedOperationalPoints,
        pathfindingResult,
        stepsCoordinates
      );

      const findCorrespondingMargin = (
        stepId: string,
        stepIndex: number,
        margins: { boundaries: string[]; values: string[] }
      ) => {
        // The first pathStep will never have its id in boundaries
        if (stepIndex === 0) return margins.values[0] === 'none' ? undefined : margins.values[0];

        const marginIndex = margins.boundaries.findIndex((boundaryId) => boundaryId === stepId);

        return marginIndex !== -1 ? margins.values[marginIndex + 1] : undefined;
      };

      if (trainSchedule.margins) {
        updatedPathSteps.forEach((step, index) => {
          step.theoreticalMargin = findCorrespondingMargin(step.id, index, trainSchedule.margins!);
        });
      }

      return {
        pathProperties: {
          electrifications,
          geometry,
          suggestedOperationalPoints,
          length: pathfindingResult.length,
          trackSectionRanges: pathfindingResult.track_section_ranges,
        },
        pathSteps: updatedPathSteps,
      };
      // TODO TS2 : test errors display after core / editoast connexion for pathProperties
    };

    const setupItineraryForTrainUpdate = async () => {
      if (!infraId) {
        return;
      }
      const trainSchedule = await getTrainScheduleById({ id: trainIdToEdit }).unwrap();

      let rollingStock: RollingStockWithLiveries | null = null;

      if (trainSchedule.rolling_stock_name) {
        try {
          rollingStock = await getRollingStockByName({
            rollingStockName: trainSchedule.rolling_stock_name,
          }).unwrap();
          const itinerary = await computeItineraryForTrainUpdate(trainSchedule, rollingStock);
          const pathSteps = itinerary?.pathSteps;

          if (pathSteps) {
            dispatch(updatePathSteps(pathSteps));
          }

          if (itinerary?.pathProperties) {
            setPathProperties(itinerary.pathProperties);
          }
        } catch (e) {
          dispatch(setFailure(castErrorToFailure(e)));
        }
      }
    };

    setupItineraryForTrainUpdate();
  }, [trainIdToEdit]);
};
export default useSetupItineraryForTrainUpdate;
