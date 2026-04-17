import { useState } from 'react';

import type {
  BoundariesData,
  ElectricalBoundariesData,
  ElectrificationUsage,
  PathPropertiesFormatted,
} from 'applications/operationalStudies/types';
import {
  transformBoundariesDataToPositionDataArray,
  transformElectricalBoundariesToRanges,
} from 'applications/operationalStudies/utils';
import type {
  RollingStockWithLiveries,
  SimulationResponseSuccess,
} from 'common/api/osrdEditoastApi';
import SpeedDistanceDiagramWrapper from 'modules/simulationResult/components/SpeedDistanceDiagram/SpeedDistanceDiagramWrapper';

type LocalSimData = {
  sim_output: SimulationResponseSuccess;
  path_properties: {
    slopes: BoundariesData;
    electrifications: ElectricalBoundariesData<ElectrificationUsage>;
    operational_points: NonNullable<PathPropertiesFormatted['operationalPoints']>;
  };
};

const DebugSpeedDistanceDiagram = ({ simulationData }: { simulationData: unknown }) => {
  const simData = simulationData as LocalSimData;
  const [height, setHeight] = useState(400);

  const pathLength = simData.sim_output.base.positions.at(-1) ?? 0;

  const pathProperties = {
    slopes: transformBoundariesDataToPositionDataArray(
      simData.path_properties.slopes,
      pathLength,
      'gradient'
    ),
    electrifications: transformElectricalBoundariesToRanges(
      simData.path_properties.electrifications,
      pathLength
    ),
    operationalPoints: simData.path_properties.operational_points,
    curves: [],
    voltages: [],
    geometry: { type: 'LineString', coordinates: [] },
  } as unknown as PathPropertiesFormatted;

  return (
    <SpeedDistanceDiagramWrapper
      timetableItemSimulation={simData.sim_output}
      pathProperties={pathProperties}
      rollingStock={{ length: 0 } as RollingStockWithLiveries}
      height={height}
      setHeight={setHeight}
    />
  );
};

export default DebugSpeedDistanceDiagram;
