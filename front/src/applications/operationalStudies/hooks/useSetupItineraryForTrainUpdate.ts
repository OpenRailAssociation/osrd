import { useEffect } from 'react';

import { type Position } from '@turf/helpers';
import { omit } from 'lodash';
import { useSelector } from 'react-redux';

import {
  osrdEditoastApi,
  type PathItemLocation,
  type PostV2InfraByInfraIdPathPropertiesApiArg,
  type PostV2InfraByInfraIdPathfindingBlocksApiArg,
  type RollingStockWithLiveries,
  type TrainScheduleResult,
  type PathfindingResult,
} from 'common/api/osrdEditoastApi';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import { formatSuggestedOperationalPoints, upsertPathStepsInOPs } from 'modules/pathfinding/utils';
import { getSupportedElectrification, isThermal } from 'modules/rollingStock/helpers/electric';
import { adjustConfWithTrainToModifyV2 } from 'modules/trainschedule/components/ManageTrainSchedule/helpers/adjustConfWithTrainToModify';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import { setFailure } from 'reducers/main';
import type { OperationalStudiesConfSliceActions } from 'reducers/osrdconf/operationalStudiesConf';
import type { PathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { addDurationToIsoDate } from 'utils/date';
import { castErrorToFailure } from 'utils/error';
import { getPointCoordinates } from 'utils/geometry';
import { mmToM } from 'utils/physics';
import { ISO8601Duration2sec } from 'utils/timeManipulation';

import type { ManageTrainSchedulePathProperties } from '../types';

type ItineraryForTrainUpdate = {
  pathSteps: (PathStep | null)[];
  pathProperties: ManageTrainSchedulePathProperties;
};

/**
 * create pathSteps in the case pathfinding fails or the train is imported from NGE
 */
const computeBasePathSteps = (trainSchedule: TrainScheduleResult) =>
  trainSchedule.path.map((step) => {
    const correspondingSchedule = trainSchedule.schedule?.find(
      (schedule) => schedule.at === step.id
    );

    const {
      arrival,
      stop_for: stopFor,
      locked,
      on_stop_signal: onStopSignal,
    } = correspondingSchedule || {};

    // TODO DROP V1: we should store the offset in mm in the store
    if ('track' in step) {
      step.offset = mmToM(step.offset!);
    }

    let name;
    if ('trigram' in step) {
      name = step.trigram + (step.secondary_code ? `/${step.secondary_code}` : '');
    } else if ('uic' in step) {
      name = step.uic.toString();
    } else if ('operational_point' in step) {
      name = step.operational_point;
    }

    return {
      ...step,
      name,
      arrival: arrival
        ? addDurationToIsoDate(trainSchedule.start_time, arrival).substring(11, 19)
        : arrival,
      stopFor: stopFor ? ISO8601Duration2sec(stopFor).toString() : stopFor,
      locked,
      onStopSignal,
    } as PathStep;
  });

export function updatePathStepsFromOperationalPoints(
  pathSteps: PathStep[],
  suggestedOperationalPoints: SuggestedOP[],
  pathfindingResult: Extract<PathfindingResult, { status: 'success' }>,
  stepsCoordinates: Position[]
) {
  const updatedPathSteps: PathStep[] = pathSteps.map((step, i) => {
    const correspondingOp = suggestedOperationalPoints.find((suggestedOp) => {
      if ('uic' in step) {
        const condition = suggestedOp.uic === step.uic;
        if ('ch' in step) {
          return condition && suggestedOp.ch === step.ch;
        }
        // When importing train from open data or from files, secondary_code might not always exist
        if (step.secondary_code) {
          return condition && suggestedOp.ch === step.secondary_code;
        }
        return condition;
      }
      if ('trigram' in step) {
        const condition = suggestedOp.trigram === step.trigram;
        if (step.secondary_code) {
          return condition && suggestedOp.ch === step.secondary_code;
        }
      }
      return false;
    });

    const { kp, name } = correspondingOp || step;

    return {
      ...step,
      kp,
      name,
      positionOnPath: pathfindingResult.path_item_positions[i],
      coordinates: stepsCoordinates[i],
    };
  });
  return updatedPathSteps;
}

const useSetupItineraryForTrainUpdate = (
  setPathProperties: (pathProperties: ManageTrainSchedulePathProperties) => void,
  trainIdToEdit: number
) => {
  const { getInfraID, getUsingElectricalProfiles } = useOsrdConfSelectors();
  const infraId = useSelector(getInfraID);
  const usingElectricalProfiles = useSelector(getUsingElectricalProfiles);
  const dispatch = useAppDispatch();
  const osrdActions = useOsrdConfActions() as OperationalStudiesConfSliceActions;
  const [getTrainScheduleById] = osrdEditoastApi.endpoints.getV2TrainScheduleById.useLazyQuery({});
  const [getRollingStockByName] =
    osrdEditoastApi.endpoints.getRollingStockNameByRollingStockName.useLazyQuery();
  const [postPathfindingBlocks] =
    osrdEditoastApi.endpoints.postV2InfraByInfraIdPathfindingBlocks.useMutation();
  const [postPathProperties] =
    osrdEditoastApi.endpoints.postV2InfraByInfraIdPathProperties.useMutation();

  useEffect(() => {
    const computeItineraryForTrainUpdate = async (
      trainSchedule: TrainScheduleResult,
      rollingStock: RollingStockWithLiveries
    ): Promise<ItineraryForTrainUpdate | null> => {
      if (!infraId) {
        return null;
      }

      // TODO TS2 : Next part might not be needed (except to updePathSteps), we need inly trainSchedulePath and
      // rolling stock infos to relaunch the pathfinding. Check for that in simulation results issue
      const params: PostV2InfraByInfraIdPathfindingBlocksApiArg = {
        infraId,
        pathfindingInputV2: {
          path_items: trainSchedule.path.map((item) =>
            omit(item, ['id', 'deleted'])
          ) as PathItemLocation[],
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
        return null;
      }
      const pathPropertiesParams: PostV2InfraByInfraIdPathPropertiesApiArg = {
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

      const computedpathSteps = computeBasePathSteps(trainSchedule);
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

      const allWaypoints = upsertPathStepsInOPs(suggestedOperationalPoints, updatedPathSteps);

      return {
        pathProperties: {
          electrifications,
          geometry,
          suggestedOperationalPoints,
          allWaypoints,
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
      let pathSteps: (PathStep | null)[] | undefined;

      if (trainSchedule.rolling_stock_name) {
        try {
          rollingStock = await getRollingStockByName({
            rollingStockName: trainSchedule.rolling_stock_name,
          }).unwrap();
          const itinerary = await computeItineraryForTrainUpdate(trainSchedule, rollingStock);
          pathSteps = itinerary?.pathSteps;

          if (itinerary?.pathProperties) {
            setPathProperties(itinerary.pathProperties);
          }
        } catch (e) {
          dispatch(setFailure(castErrorToFailure(e)));
        }
      }

      adjustConfWithTrainToModifyV2(
        trainSchedule,
        pathSteps || computeBasePathSteps(trainSchedule),
        rollingStock?.id,
        dispatch,
        usingElectricalProfiles,
        osrdActions
      );
    };

    setupItineraryForTrainUpdate();
  }, [trainIdToEdit]);
};
export default useSetupItineraryForTrainUpdate;
