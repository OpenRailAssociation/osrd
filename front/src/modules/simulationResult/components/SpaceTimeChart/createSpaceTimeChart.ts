import * as d3 from 'd3';
import { select as d3select } from 'd3-selection';

import { Chart, SimulationTrain, ConsolidatedPosition } from 'reducers/osrdsimulation/types';
import { CHART_AXES } from 'modules/simulationResult/consts';
import {
  defineLinear,
  defineTime,
} from 'modules/simulationResult/components/ChartHelpers/ChartHelpers';
import defineChart from 'modules/simulationResult/components/ChartHelpers/defineChart';
import { SPACE_TIME_CHART_ID } from './consts';

function getMaxPosition(trains: SimulationTrain[], pos: 'tailPosition' | 'headPosition') {
  return d3.max(
    trains.flatMap(
      (train) =>
        d3.max(
          train[pos].map(
            (section) =>
              d3.max(section.map((step: ConsolidatedPosition) => step.position)) as number
          )
        ) as number
    )
  ) as number;
}

export default function createSpaceTimeChart(
  chart: Chart | undefined,
  trains: SimulationTrain[],
  chartHeight: number,
  ref: React.MutableRefObject<HTMLDivElement> | React.RefObject<HTMLDivElement>,
  reset: boolean,
  rotate: boolean
): Chart {
  d3select(`#${SPACE_TIME_CHART_ID}`).remove();

  const resetChart = chart === undefined || reset;

  const times = trains.flatMap((train) =>
    (train.eco_headPosition ?? train.headPosition).flatMap((section) =>
      section.map((position) => position.time as Date)
    )
  );

  const maxPosition = d3.max([
    getMaxPosition(trains, 'tailPosition'),
    getMaxPosition(trains, 'headPosition'),
  ]);

  const defineX = resetChart ? defineTime(d3.extent(times) as [Date, Date]) : chart.x;

  const defineY = resetChart ? defineLinear(Number(maxPosition), 0.05) : chart.y;

  const width = parseInt(d3select(`#container-${SPACE_TIME_CHART_ID}`)?.style('width'), 10);

  const chartLocal = defineChart(
    width,
    chartHeight,
    defineX,
    defineY,
    ref,
    rotate,
    CHART_AXES.SPACE_TIME,
    SPACE_TIME_CHART_ID
  );
  return resetChart ? chartLocal : { ...chartLocal, x: chart.x, y: chart.y };
}
