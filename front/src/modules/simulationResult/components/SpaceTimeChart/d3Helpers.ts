import type { TrainSpaceTimeData } from 'applications/operationalStudies/types';
import type { PathProperties, TrainScheduleResult } from 'common/api/osrdEditoastApi';
import createSpaceTimeChart from 'modules/simulationResult/components/SpaceTimeChart/createSpaceTimeChart';
import drawTrain from 'modules/simulationResult/components/SpaceTimeChart/drawTrain';
import type {
  AllowancesSettings,
  Chart,
  OsrdSimulationState,
  SimulationTrain,
  Train,
} from 'reducers/osrdsimulation/types';
import { mmToM } from 'utils/physics';

import type { DispatchUpdateSelectedTrainId } from './types';

// TODO DROP V1: remove this
function drawOPs(chartLocal: Chart, projectedTrainSimulation: Train, rotate: boolean) {
  const operationalPointsZone = chartLocal.drawZone
    .append('g')
    .attr('id', 'get-operationalPointsZone');
  projectedTrainSimulation.base.stops.forEach((stop) => {
    operationalPointsZone
      .append('line')
      .datum(stop.position)
      .attr('id', `op-${stop.id}`)
      .attr('class', 'op-line')
      .attr('x1', rotate ? (d) => chartLocal.x(d) : 0)
      .attr('y1', rotate ? 0 : (d) => chartLocal.y(d))
      .attr('x2', rotate ? (d) => chartLocal.x(d) : chartLocal.width)
      .attr('y2', rotate ? chartLocal.height : (d) => chartLocal.y(d));
    operationalPointsZone
      .append('text')
      .datum(stop.position)
      .attr('class', 'op-text')
      .text(`${stop.name || 'Unknown'} ${Math.round(stop.position) / 1000}`)
      .attr('x', rotate ? (d) => chartLocal.x(d) : 0)
      .attr('y', rotate ? 0 : (d) => chartLocal.y(d))
      .attr('text-anchor', 'center')
      .attr('dx', 5)
      .attr('dy', rotate ? 15 : -5);
  });
}

const drawOPsV2 = (
  chartLocal: Chart,
  operationalPoints: NonNullable<PathProperties['operational_points']>,
  rotate: boolean
) => {
  const operationalPointsZone = chartLocal.drawZone
    .append('g')
    .attr('id', 'get-operationalPointsZone');
  operationalPoints.forEach((op) => {
    operationalPointsZone
      .append('line')
      .datum(mmToM(op.position))
      .attr('id', `op-${op.id}`)
      .attr('class', 'op-line')
      .attr('x1', rotate ? (d) => chartLocal.x(d) : 0)
      .attr('y1', rotate ? 0 : (d) => chartLocal.y(d))
      .attr('x2', rotate ? (d) => chartLocal.x(d) : chartLocal.width)
      .attr('y2', rotate ? chartLocal.height : (d) => chartLocal.y(d));
    operationalPointsZone
      .append('text')
      .datum(mmToM(op.position))
      .attr('class', 'op-text')
      .text(
        `${op.extensions?.identifier?.name || 'Unknown'} ${Math.round(mmToM(op.position)) / 1000}`
      )
      .attr('x', rotate ? (d) => chartLocal.x(d) : 0)
      .attr('y', rotate ? 0 : (d) => chartLocal.y(d))
      .attr('text-anchor', 'center')
      .attr('dx', 5)
      .attr('dy', rotate ? 15 : -5);
  });
};

const drawAxisTitle = (chart: Chart, rotate: boolean) => {
  chart.drawZone
    .append('text')
    .attr('class', 'axis-unit')
    .attr('text-anchor', 'end')
    .attr('transform', rotate ? 'rotate(0)' : 'rotate(-90)')
    .attr('x', rotate ? chart.width - 10 : -10)
    .attr('y', rotate ? chart.height - 10 : 20)
    .text('KM');
};

// TODO DROP V1: remove this
const drawAllTrains = (
  allowancesSettings: AllowancesSettings,
  chart: Chart | undefined,
  dispatchUpdateSelectedTrainId: DispatchUpdateSelectedTrainId,
  heightOfSpaceTimeChart: number,
  ref: React.MutableRefObject<HTMLDivElement> | React.RefObject<HTMLDivElement>,
  reset: boolean,
  rotate: boolean,
  selectedProjection: OsrdSimulationState['selectedProjection'],
  selectedTrain: Train,
  setDragOffset: React.Dispatch<React.SetStateAction<number>>,
  simulationTrains: Train[],
  trainsToDraw: SimulationTrain[]
) => {
  const chartLocal = createSpaceTimeChart(
    chart,
    trainsToDraw,
    heightOfSpaceTimeChart,
    ref,
    reset,
    rotate
  );

  const projectedSimulationTrain = simulationTrains.find(
    (train) => train.id === selectedProjection?.id
  );

  if (projectedSimulationTrain) {
    drawOPs(chartLocal, projectedSimulationTrain, rotate);
  }

  drawAxisTitle(chartLocal, rotate);
  trainsToDraw.forEach((train) => {
    drawTrain(
      chartLocal,
      dispatchUpdateSelectedTrainId,
      train.id === selectedProjection?.id,
      train.id === selectedTrain?.id,
      rotate,
      setDragOffset,
      train,
      allowancesSettings
    );
  });
  return chartLocal;
};

const drawAllTrainsV2 = (
  chart: Chart | undefined,
  dispatchUpdateSelectedTrainId: DispatchUpdateSelectedTrainId,
  heightOfSpaceTimeChart: number,
  ref: React.MutableRefObject<HTMLDivElement> | React.RefObject<HTMLDivElement>,
  reset: boolean,
  rotate: boolean,
  trainIdUsedForProjection: number,
  selectedTrain: TrainScheduleResult,
  setDragOffset: React.Dispatch<React.SetStateAction<number>>,
  simulationTrains: TrainSpaceTimeData[],
  trainsToDraw: SimulationTrain[],
  operationalPoints: NonNullable<PathProperties['operational_points']>
) => {
  const chartLocal = createSpaceTimeChart(
    chart,
    trainsToDraw,
    heightOfSpaceTimeChart,
    ref,
    reset,
    rotate
  );

  const projectedSimulationTrain = simulationTrains.find(
    (train) => train.id === trainIdUsedForProjection
  );

  if (projectedSimulationTrain) {
    drawOPsV2(chartLocal, operationalPoints, rotate);
  }

  drawAxisTitle(chartLocal, rotate);
  trainsToDraw.forEach((train) => {
    drawTrain(
      chartLocal,
      dispatchUpdateSelectedTrainId,
      train.id === trainIdUsedForProjection,
      train.id === selectedTrain?.id,
      rotate,
      setDragOffset,
      train
    );
  });
  return chartLocal;
};

export { drawOPs, drawAllTrains, drawAllTrainsV2 };
