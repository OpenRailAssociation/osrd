import * as d3 from 'd3';
import { select as d3select } from 'd3-selection';

import { Chart, SimulationTrain } from 'reducers/osrdsimulation/types';
import { defineLinear, defineTime } from 'applications/osrd/components/Helpers/ChartHelpers';
import defineChart from 'applications/osrd/components/Simulation/defineChart';

// This is only used by SpaceTimeChart for now.
export default function createChart(
  chart: Chart,
  chartID: string,
  dataSimulation: SimulationTrain[],
  heightOfSpaceTimeChart: number,
  keyValues: string[],
  ref: React.MutableRefObject<HTMLDivElement>,
  reset: boolean,
  rotate: boolean
): Chart {
  d3select(`#${chartID}`).remove();

  const xValues: (number | Date)[] = dataSimulation
    .map((train) =>
      train.headPosition.map((section) =>
        section.map((position) => (keyValues[0] === 'time' ? position.time : position.position))
      )
    )
    .flat(Infinity) as (number | Date)[];

  const dataSimulationLinearMax = d3.max([
    d3.max(
      [].concat(
        ...dataSimulation.map((train) =>
          d3.max(
            train.tailPosition.map((section) =>
              d3.max(section.map((step: any) => step[keyValues[1]]))
            )
          )
        )
      )
    ),
    d3.max(
      [].concat(
        ...dataSimulation.map((train) =>
          d3.max(
            train.headPosition.map((section) =>
              d3.max(section.map((step: any) => step[keyValues[1]]))
            )
          )
        )
      )
    ),
  ] as any);



  const defineX = chart === undefined || reset ? defineTime(d3.extent(xValues)) : chart.x;

  const defineY =
    chart === undefined || reset ? defineLinear(dataSimulationLinearMax, 0.05) : chart.y;

  const width = parseInt(d3select(`#container-${chartID}`).style('width'), 10);
  const chartLocal = defineChart(
    width,
    heightOfSpaceTimeChart,
    defineX,
    defineY,
    ref,
    rotate,
    keyValues,
    chartID
  );
  return chart === undefined || reset ? chartLocal : { ...chartLocal, x: chart.x, y: chart.y };
}
