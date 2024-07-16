import { useEffect } from 'react';

import { omit } from 'lodash';
import { useSelector } from 'react-redux';

import {
  osrdEditoastApi,
  type PostV2InfraByInfraIdPathPropertiesApiArg,
  type PostV2InfraByInfraIdPathfindingBlocksApiArg,
} from 'common/api/osrdEditoastApi';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import { formatSuggestedOperationalPoints, upsertPathStepsInOPs } from 'modules/pathfinding/utils';
import { getSupportedElectrification, isThermal } from 'modules/rollingStock/helpers/electric';
import { adjustConfWithTrainToModifyV2 } from 'modules/trainschedule/components/ManageTrainSchedule/helpers/adjustConfWithTrainToModify';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import { setFailure } from 'reducers/main';
import type { OperationalStudiesConfSliceActions } from 'reducers/osrdconf/operationalStudiesConf';
import type { PathItem, PathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { addDurationToIsoDate } from 'utils/date';
import { castErrorToFailure } from 'utils/error';
import { getPointCoordinates } from 'utils/geometry';
import { ISO8601Duration2sec } from 'utils/timeManipulation';

import type { ManageTrainSchedulePathProperties } from '../types';

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
    const setupItineraryForTrainUpdate = async () => {
      const trainSchedule = await getTrainScheduleById({
        id: trainIdToEdit,
      }).unwrap();
      if (infraId) {
        const rollingStock = await getRollingStockByName({
          rollingStockName: trainSchedule.rolling_stock_name,
        }).unwrap();
        // TODO TS2 : Next part might not be needed (except to updePathSteps), we need inly trainSchedulePath and
        // rolling stock infos to relaunch the pathfinding. Check for that in simulation results issue
        const params: PostV2InfraByInfraIdPathfindingBlocksApiArg = {
          infraId,
          pathfindingInputV2: {
            path_items: trainSchedule.path.map((item) =>
              omit(item, ['id', 'deleted'])
            ) as PathItem[],
            rolling_stock_is_thermal: isThermal(rollingStock.effort_curves.modes),
            rolling_stock_loading_gauge: rollingStock.loading_gauge,
            rolling_stock_supported_electrifications: getSupportedElectrification(
              rollingStock.effort_curves.modes
            ),
            rolling_stock_supported_signaling_systems: rollingStock.supported_signaling_systems,
          },
        };
        try {
          const pathfindingResult = await postPathfindingBlocks(params).unwrap();
          if (pathfindingResult.status === 'success') {
            const pathPropertiesParams: PostV2InfraByInfraIdPathPropertiesApiArg = {
              infraId,
              props: ['electrifications', 'geometry', 'operational_points'],
              pathPropertiesInput: {
                track_section_ranges: pathfindingResult.track_section_ranges,
              },
            };
            const { electrifications, geometry, operational_points } =
              await postPathProperties(pathPropertiesParams).unwrap();
            if (electrifications && geometry && operational_points) {
              const stepsCoordinates = pathfindingResult.path_item_positions.map((position) =>
                getPointCoordinates(geometry, pathfindingResult.length, position)
              );
              const suggestedOperationalPoints: SuggestedOP[] = formatSuggestedOperationalPoints(
                operational_points,
                geometry,
                pathfindingResult.length
              );

              const updatedPathSteps: PathStep[] = trainSchedule.path.map((step, i) => {
                const correspondingOp = suggestedOperationalPoints.find(
                  (suggestedOp) =>
                    'uic' in step &&
                    suggestedOp.uic === step.uic &&
                    suggestedOp.ch === step.secondary_code
                );

                const correspondingSchedule = trainSchedule.schedule?.find(
                  (schedule) => schedule.at === step.id
                );

                const { kp, name, ch } = correspondingOp || {};

                const {
                  arrival,
                  stop_for: stopFor,
                  locked,
                  on_stop_signal: onStopSignal,
                } = correspondingSchedule || {};

                const stepWithoutSecondaryCode = omit(step, ['secondary_code']);

                return {
                  ...stepWithoutSecondaryCode,
                  ch,
                  kp,
                  name,
                  positionOnPath: pathfindingResult.path_item_positions[i],
                  arrival: arrival
                    ? addDurationToIsoDate(trainSchedule.start_time, arrival).substring(11, 19)
                    : arrival,
                  stopFor: stopFor ? ISO8601Duration2sec(stopFor) : stopFor,
                  locked,
                  onStopSignal,
                  coordinates: stepsCoordinates[i],
                } as PathStep;
              });

              const findCorrespondingMargin = (
                stepId: string,
                margins: { boundaries: string[]; values: string[] }
              ) => {
                if (stepIndex === updatedPathSteps.length - 1) return undefined;

                // The first pathStep will never have its id in boundaries
                if (stepIndex === 0) return margins.values[0];

                const marginIndex = margins.boundaries.findIndex(
                  (boundaryId) => boundaryId === stepId
                );

                return marginIndex !== -1 ? margins.values[marginIndex + 1] : undefined;
              };

              if (trainSchedule.margins) {
                updatedPathSteps.forEach((step) => {
                  step.theoreticalMargin = findCorrespondingMargin(step.id, trainSchedule.margins!);
                });
              }

              const allWaypoints = upsertPathStepsInOPs(
                suggestedOperationalPoints,
                updatedPathSteps
              );

              setPathProperties({
                electrifications,
                geometry,
                suggestedOperationalPoints,
                allWaypoints,
                length: pathfindingResult.length,
                trackSectionRanges: pathfindingResult.track_section_ranges,
              });
              adjustConfWithTrainToModifyV2(
                trainSchedule,
                updatedPathSteps,
                rollingStock.id,
                dispatch,
                usingElectricalProfiles,
                osrdActions
              );
            }
          }
          // TODO TS2 : test errors display after core / editoast connexion for pathProperties
        } catch (e) {
          dispatch(setFailure(castErrorToFailure(e)));
        }
      }
    };
    setupItineraryForTrainUpdate();
  }, [trainIdToEdit]);
};
export default useSetupItineraryForTrainUpdate;
