import { useMemo } from 'react';

import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import formatPowerRestrictionRangesWithHandled from 'modules/powerRestriction/helpers/formatPowerRestrictionRangesWithHandled';
import useSelectedTimetableItem from 'modules/timetableItem/hooks/useSelectedTimetableItem';
import { getOperationalStudiesElectricalProfileSetId } from 'reducers/osrdconf/operationalStudiesConf/selectors';
import { getSelectedTrainId } from 'reducers/simulationResults/selectors';
import { Duration } from 'utils/duration';
import {
  extractOccurrenceIndexFromOccurrenceId,
  isPacedTrainResponseWithPacedTrainId,
  isTrainScheduleId,
} from 'utils/trainId';

import type { SimulationResults } from '../types';
import { preparePathPropertiesData } from '../utils';

/**
 * Prepare data to be used in simulation results
 */
const useSimulationResults = (infraId: number): SimulationResults | undefined => {
  const { t } = useTranslation('operational-studies');

  const electricalProfileSetId = useSelector(getOperationalStudiesElectricalProfileSetId);
  const selectedTrainId = useSelector(getSelectedTrainId);

  const timetableItem = useSelectedTimetableItem();

  const train = useMemo(() => {
    if (!selectedTrainId || !timetableItem) return undefined;
    if (!isPacedTrainResponseWithPacedTrainId(timetableItem)) {
      return timetableItem;
    }

    if (isTrainScheduleId(selectedTrainId)) {
      throw new Error(`trainId ${selectedTrainId} should be a occurrence id`);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, exceptions, paced, ...trainProps } = timetableItem;

    const occurrenceIndex = extractOccurrenceIndexFromOccurrenceId(selectedTrainId);
    const pacedTrainIntervalInMs = Duration.parse(timetableItem.paced.interval).ms;

    const occurrenceStartTime: string = dayjs(timetableItem.start_time)
      .add(occurrenceIndex * pacedTrainIntervalInMs, 'ms')
      .toISOString();
    return { ...trainProps, id: selectedTrainId, start_time: occurrenceStartTime };
  }, [timetableItem]);

  const { currentData: pathfinding } = osrdEditoastApi.endpoints.getTrainPath.useQuery(
    {
      id: selectedTrainId!,
      infraId,
    },
    {
      skip: !selectedTrainId,
    }
  );

  const { currentData: simulation } = osrdEditoastApi.endpoints.getTrainSimulation.useQuery(
    {
      id: selectedTrainId!,
      infraId,
      electricalProfileSetId,
    },
    {
      skip: !selectedTrainId,
    }
  );

  // TODO: replace this API call by extracting the rolling stock from the rolling
  // stocks list
  const { currentData: rollingStock } =
    osrdEditoastApi.endpoints.getRollingStockNameByRollingStockName.useQuery(
      {
        rollingStockName: train?.rolling_stock_name || '',
      },
      {
        skip: !train,
      }
    );

  const { currentData: rawPathProperties } =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathProperties.useQuery(
      {
        infraId,
        props: ['electrifications', 'geometry', 'operational_points', 'curves', 'slopes'],
        pathPropertiesInput: {
          track_section_ranges:
            pathfinding?.status === 'success' ? pathfinding.track_section_ranges : [],
        },
      },
      { skip: pathfinding?.status !== 'success' }
    );

  if (
    !train ||
    pathfinding?.status !== 'success' ||
    simulation?.status !== 'success' ||
    !rawPathProperties ||
    !rollingStock
  ) {
    return undefined;
  }

  const pathProperties = preparePathPropertiesData(
    simulation.electrical_profiles,
    rawPathProperties,
    pathfinding,
    train.path,
    t
  );

  const powerRestrictions =
    formatPowerRestrictionRangesWithHandled({
      selectedTimetableItem: train,
      selectedTrainRollingStock: rollingStock,
      pathfindingResult: pathfinding,
      pathProperties,
    }) ?? [];

  return {
    train,
    rollingStock,
    simulation,
    path: pathfinding,
    pathProperties,
    powerRestrictions,
  };
};

export default useSimulationResults;
