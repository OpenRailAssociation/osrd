import { useState } from 'react';

import type { PathPropertiesFormatted } from 'applications/operationalStudies/types';
import { transformBoundariesDataToPositionDataArray } from 'applications/operationalStudies/utils';
import type { CoreDebugSimulationData, RollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import SpeedDistanceDiagramWrapper from 'modules/simulationResult/components/SpeedDistanceDiagram/SpeedDistanceDiagramWrapper';

type DebugSpeedDistanceDiagramProps = { simulationData: CoreDebugSimulationData };

const DebugSpeedDistanceDiagram = ({ simulationData }: DebugSpeedDistanceDiagramProps) => {
  const [height, setHeight] = useState(400);
  const sim_output = simulationData.sim_output;
  if (!sim_output) {
    return null;
  }

  const pathLength = sim_output.base.positions.at(-1) ?? 0;

  const pathProperties = {
    slopes: transformBoundariesDataToPositionDataArray(
      simulationData.path_properties.slopes,
      pathLength,
      'gradient'
    ),
    electrifications: [], // We should be able to forward electrification, but the types don't quite line up
    operationalPoints: simulationData.path_properties.operational_points,
    curves: [],
    voltages: [],
    geometry: { type: 'LineString', coordinates: [] },
  } as unknown as PathPropertiesFormatted;

  return (
    <SpeedDistanceDiagramWrapper
      timetableItemSimulation={sim_output}
      pathProperties={pathProperties}
      rollingStock={{ length: 0 } as RollingStockWithLiveries}
      initialLayersDisplay={{ speedLimits: true }}
      height={height}
      setHeight={setHeight}
    />
  );
};

export default DebugSpeedDistanceDiagram;
