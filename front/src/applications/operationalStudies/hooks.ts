import { useEffect, useState } from 'react';

import { useSelector } from 'react-redux';

import { enhancedEditoastApi } from 'common/api/enhancedEditoastApi';
import {
  osrdEditoastApi,
  type PostV2InfraByInfraIdPathPropertiesApiArg,
  type PostV2InfraByInfraIdPathfindingBlocksApiArg,
  type SimulationPowerRestrictionRange,
} from 'common/api/osrdEditoastApi';
import { useInfraID, useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import { formatSuggestedOperationalPoints, upsertViasInOPs } from 'modules/pathfinding/utils';
import { getSupportedElectrification, isThermal } from 'modules/rollingStock/helpers/electric';
import { sec2d3datetime } from 'modules/simulationResult/components/ChartHelpers/ChartHelpers';
import {
  ChartSynchronizerV2,
  type ChartSynchronizerTrainData,
} from 'modules/simulationResult/components/ChartHelpers/ChartSynchronizerV2';
import { adjustConfWithTrainToModifyV2 } from 'modules/trainschedule/components/ManageTrainSchedule/helpers/adjustConfWithTrainToModify';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import { setFailure } from 'reducers/main';
import type { PathStep } from 'reducers/osrdconf/types';
import { getSelectedTrainId } from 'reducers/osrdsimulation/selectors';
import { useAppDispatch } from 'store';
import { isoDateToMs } from 'utils/date';
import { castErrorToFailure } from 'utils/error';
import { getPointCoordinates } from 'utils/geometry';
import { mmToM } from 'utils/physics';

import type { ManageTrainSchedulePathProperties, PathPropertiesFormatted } from './types';
import {
  formatPowerRestrictionRanges,
  formatPowerRestrictionRangesWithHandled,
  preparePathPropertiesData,
} from './utils';

/**
 * Hook to relaunch the pathfinding when editing a train
 */
export const useSetupItineraryForTrainUpdate = (
  setPathProperties: (pathProperties: ManageTrainSchedulePathProperties) => void
) => {
  const { getInfraID, getTrainScheduleIDsToModify, getUsingElectricalProfiles } =
    useOsrdConfSelectors();
  const infraId = useSelector(getInfraID);
  const trainScheduleIDsToModify = useSelector(getTrainScheduleIDsToModify);
  const usingElectricalProfiles = useSelector(getUsingElectricalProfiles);
  const dispatch = useAppDispatch();
  const osrdActions = useOsrdConfActions();

  const [getTrainScheduleById] = osrdEditoastApi.endpoints.getV2TrainScheduleById.useLazyQuery({});
  const [getRollingStockByName] =
    osrdEditoastApi.endpoints.getRollingStockNameByRollingStockName.useLazyQuery();
  const [postPathfindingBlocks] =
    osrdEditoastApi.endpoints.postV2InfraByInfraIdPathfindingBlocks.useMutation();
  const [postPathProperties] =
    enhancedEditoastApi.endpoints.postV2InfraByInfraIdPathProperties.useMutation();

  useEffect(() => {
    const setupItineraryForTrainUpdate = async () => {
      const trainSchedule = await getTrainScheduleById({
        id: trainScheduleIDsToModify[0],
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
            path_items: trainSchedule.path,
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
              const stepsCoordinates = pathfindingResult.path_items_positions.map((position) =>
                getPointCoordinates(geometry, pathfindingResult.length, position)
              );

              const formatedPathSteps: PathStep[] = trainSchedule.path.map((step, i) => ({
                ...step,
                coordinates: stepsCoordinates[i],
                positionOnPath: pathfindingResult.path_items_positions[i],
              }));

              const suggestedOperationalPoints: SuggestedOP[] = formatSuggestedOperationalPoints(
                operational_points,
                geometry,
                pathfindingResult.length
              );

              const allVias = upsertViasInOPs(suggestedOperationalPoints, formatedPathSteps);

              setPathProperties({
                electrifications,
                geometry,
                suggestedOperationalPoints,
                allVias,
                length: pathfindingResult.length,
              });

              adjustConfWithTrainToModifyV2(
                trainSchedule,
                formatedPathSteps,
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

    if (trainScheduleIDsToModify.length > 0) setupItineraryForTrainUpdate();
  }, [trainScheduleIDsToModify]);
};

/**
 * Prepare datas to be used in simulation results
 */
export const useSimulationResults = () => {
  const infraId = useInfraID();
  const selectedTrainId = useSelector(getSelectedTrainId);

  const [pathProperties, setPathProperties] = useState<PathPropertiesFormatted>();
  const [formattedPowerRestrictions, setFormattedPowerRestrictions] = useState<
    SimulationPowerRestrictionRange[]
  >([]);

  const { data: selectedTrainSchedule } = osrdEditoastApi.endpoints.getV2TrainScheduleById.useQuery(
    {
      id: selectedTrainId as number,
    },
    { skip: !selectedTrainId }
  );

  const { data: selectedTrainRollingStock } =
    osrdEditoastApi.endpoints.getRollingStockNameByRollingStockName.useQuery(
      {
        rollingStockName: selectedTrainSchedule?.rolling_stock_name as string,
      },
      { skip: !selectedTrainSchedule }
    );

  const { data: pathfindingResult } = osrdEditoastApi.endpoints.getV2TrainScheduleByIdPath.useQuery(
    {
      id: selectedTrainId as number,
      infraId: infraId as number,
    },
    { skip: !selectedTrainId || !infraId }
  );

  const { data: trainSimulation } =
    osrdEditoastApi.endpoints.getV2TrainScheduleByIdSimulation.useQuery(
      { id: selectedTrainId as number, infraId: infraId as number },
      { skip: !selectedTrainId || !infraId }
    );

  const [postPathProperties] =
    enhancedEditoastApi.endpoints.postV2InfraByInfraIdPathProperties.useMutation();

  useEffect(() => {
    const getPathProperties = async () => {
      if (
        infraId &&
        selectedTrainSchedule &&
        selectedTrainRollingStock &&
        pathfindingResult &&
        pathfindingResult.status === 'success' &&
        trainSimulation?.status === 'success'
      ) {
        const pathPropertiesParams: PostV2InfraByInfraIdPathPropertiesApiArg = {
          infraId,
          props: ['electrifications', 'geometry', 'operational_points', 'curves', 'slopes'],
          pathPropertiesInput: {
            track_section_ranges: pathfindingResult.track_section_ranges,
          },
        };
        const pathPropertiesResult = await postPathProperties(pathPropertiesParams).unwrap();

        const formattedPathProperties = preparePathPropertiesData(
          trainSimulation.electrical_profiles,
          pathPropertiesResult,
          pathfindingResult.length
        );
        setPathProperties(formattedPathProperties);

        // Format power restrictions
        if (
          selectedTrainSchedule &&
          selectedTrainSchedule.power_restrictions &&
          selectedTrainRollingStock
        ) {
          const powerRestrictionsRanges = formatPowerRestrictionRanges(
            selectedTrainSchedule.power_restrictions,
            selectedTrainSchedule.path,
            pathfindingResult.path_items_positions
          );
          const powerRestrictionsWithHandled = formatPowerRestrictionRangesWithHandled(
            powerRestrictionsRanges,
            formattedPathProperties.electrifications,
            selectedTrainRollingStock.effort_curves.modes
          );

          setFormattedPowerRestrictions(powerRestrictionsWithHandled);
        }

        // Format chart synchronizer data
        const {
          baseHeadPositions,
          baseTailPositions,
          baseSpeeds,
          marginSpeeds,
          ecoHeadPosition,
          ecoTailPosition,
          ecoSpeeds,
        } = trainSimulation.base.positions.reduce(
          (results, position, index) => {
            const positionInMeters = mmToM(position);

            // TODO GET v2 : probably remove this conversion as trains will travel on several days
            // The chart time axis is set by d3 function *sec2d3datetime* which start the chart at 01/01/1900 00:00:00
            // As javascript new Date() util takes count of the minutes lost since 1/1/1900 (9min and 21s), we have
            // to use sec2d3datetime here as well to set the times on the chart
            const timeDifferenceMinutes = new Date().getTimezoneOffset();
            const time = sec2d3datetime(
              isoDateToMs(selectedTrainSchedule.start_time) / 1000 +
                Math.abs(timeDifferenceMinutes) * 60 +
                trainSimulation.base.times[index] / 1000
            );

            if (!time) {
              return results;
            }

            results.baseHeadPositions.push({ position: positionInMeters, time });
            results.baseTailPositions.push({
              position: positionInMeters - selectedTrainRollingStock.length,
              time,
            });
            results.baseSpeeds.push({
              position: positionInMeters,
              time,
              speed: trainSimulation.base.speeds[index],
            });
            results.marginSpeeds.push({
              position: positionInMeters,
              time,
              speed: trainSimulation.final_output.speeds[index],
            });
            results.ecoHeadPosition.push({ position, time });
            results.ecoTailPosition.push({
              position: positionInMeters - selectedTrainRollingStock.length,
              time,
            });
            results.ecoSpeeds.push({
              position: positionInMeters,
              time,
              speed: trainSimulation.final_output.speeds[index],
            });
            return results;
          },
          {
            baseHeadPositions: [] as { time: Date; position: number }[],
            baseTailPositions: [] as { time: Date; position: number }[],
            baseSpeeds: [] as { time: Date; position: number; speed: number }[],
            marginSpeeds: [] as { time: Date; position: number; speed: number }[],
            ecoHeadPosition: [] as { time: Date; position: number }[],
            ecoTailPosition: [] as { time: Date; position: number }[],
            ecoSpeeds: [] as { time: Date; position: number; speed: number }[],
          }
        );

        const formattedChartSynchronizerData: ChartSynchronizerTrainData = {
          headPosition: baseHeadPositions,
          tailPosition: baseTailPositions,
          speed: baseSpeeds,
          margins_speed: marginSpeeds,
          eco_headPosition: ecoHeadPosition,
          eco_tailPosition: ecoTailPosition,
          eco_speed: ecoSpeeds,
        };

        ChartSynchronizerV2.getInstance().setTrainData(formattedChartSynchronizerData);
      }
    };
    getPathProperties();
  }, [
    pathfindingResult,
    trainSimulation,
    infraId,
    selectedTrainSchedule,
    selectedTrainRollingStock,
  ]);

  return {
    selectedTrain: selectedTrainSchedule,
    selectedTrainRollingStock,
    selectedTrainPowerRestrictions: formattedPowerRestrictions,
    trainSimulation,
    pathProperties,
  };
};
