import { useState } from 'react';

import { omit } from 'lodash';

import type {
  ElectricalBoundariesData,
  ElectrificationUsage,
  PathPropertiesFormatted,
} from 'applications/operationalStudies/types';
import {
  transformBoundariesDataToPositionDataArray,
  transformElectricalBoundariesToRanges,
} from 'applications/operationalStudies/utils';
import type { RollingStockWithLiveries, SimDebugData } from 'common/api/osrdEditoastApi';
import SpeedDistanceDiagramWrapper from 'modules/simulationResult/components/SpeedDistanceDiagram/SpeedDistanceDiagramWrapper';

const DebugSpeedDistanceDiagram = ({ simData }: { simData: SimDebugData }) => {
  const [height, setHeight] = useState(400);

  if (!simData.sim_output) return null;

  const pathLength = simData.sim_output.base.positions.at(-1) ?? 0;

  const pathProperties: PathPropertiesFormatted = {
    slopes: transformBoundariesDataToPositionDataArray(
      simData.path_properties.slopes,
      pathLength,
      'gradient'
    ),
    electrifications: transformElectricalBoundariesToRanges(
      simData.path_properties.electrifications as ElectricalBoundariesData<ElectrificationUsage>,
      pathLength
    ),
    operationalPoints: simData.path_properties.operational_points.map((op) => ({
      ...omit(op, 'id'),
      opId: op.id,
      waypointId: `${op.id}-${op.position}`,
      pathItemId: null,
      location: {
        type: 'operational_point_part_reference',
        operational_point: { type: 'id', operational_point: op.id },
      },
    })),
    curves: [],
    voltages: [],
    geometry: { type: 'MultiLineString', coordinates: [] },
  };

  return (
    <SpeedDistanceDiagramWrapper
      trainScheduleSimulation={simData.sim_output}
      pathProperties={pathProperties}
      rollingStock={{ length: 0 } as RollingStockWithLiveries}
      initialLayersDisplay={{ speedLimits: true }}
      height={height}
      setHeight={setHeight}
    />
  );
};

export default DebugSpeedDistanceDiagram;
