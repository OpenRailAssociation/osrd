import React, {
  useState, useEffect, useRef,
} from 'react';
import { useSelector, useDispatch } from 'react-redux';
import * as d3 from 'd3';
import { LIST_VALUES_NAME_SPACE_TIME } from 'applications/osrd/components/Simulation/consts';
import { SNCFCOLORS } from 'applications/osrd/consts';
import {
  defineLinear, defineTime, formatStepsWithTime,
  handleWindowResize, mergeDatasArea, timeShiftTrain, timeShiftStops,
} from 'applications/osrd/components/Helpers/ChartHelpers';
import {
  updateChart, updateMustRedraw, updateSimulation, updateSelectedTrain,
} from 'reducers/osrdsimulation';
import ChartModal from 'applications/osrd/components/Simulation/ChartModal';
import defineChart from 'applications/osrd/components/Simulation/defineChart';
import drawCurve from 'applications/osrd/components/Simulation/drawCurve';
import drawArea from 'applications/osrd/components/Simulation/drawArea';
import drawText from 'applications/osrd/components/Simulation/drawText';
import findConflicts from 'applications/osrd/components/Simulation/findConflicts';
import enableInteractivity, { traceVerticalLine } from 'applications/osrd/components/Simulation/enableInteractivity';

const CHART_ID = 'SpaceTimeChart';

const createChart = (chart, dataSimulation, keyValues, ref, rotate) => {
  d3.select(`#${CHART_ID}`).remove();

  const dataSimulationTime = d3.extent([].concat(...dataSimulation.map(
    (train) => d3.extent(train.headPosition, (d) => d[keyValues[0]]),
  )));

  const dataSimulationLinearMax = d3.max([
    d3.max([].concat(...dataSimulation.map(
      (train) => d3.max(train.endBlockOccupancy.map((step) => step[keyValues[1]])),
    ))),
    d3.max([].concat(...dataSimulation.map(
      (train) => d3.max(train.startBlockOccupancy.map((step) => step[keyValues[1]])),
    ))),
    d3.max([].concat(...dataSimulation.map(
      (train) => d3.max(train.headPosition.map((step) => step[keyValues[1]])),
    ))),
    d3.max([].concat(...dataSimulation.map(
      (train) => d3.max(train.tailPosition.map((step) => step[keyValues[1]])),
    ))),
  ]);

  const defineX = (chart === undefined)
    ? defineTime(dataSimulationTime, keyValues[0])
    : chart.x;
  const defineY = (chart === undefined)
    ? defineLinear(dataSimulationLinearMax, 0.05)
    : chart.y;

  const width = parseInt(d3.select(`#container-${CHART_ID}`).style('width'), 10);
  const chartLocal = defineChart(width, 300, defineX, defineY, ref, rotate, keyValues, CHART_ID);
  return (chart === undefined)
    ? chartLocal
    : { ...chartLocal, x: chart.x, y: chart.y };
};

const drawTrain = (
  chart, dispatch, dataSimulation, isSelected, keyValues,
  offsetTimeByDragging, rotate, setDragOffset,
) => {
  const groupID = `spaceTime-${dataSimulation.trainNumber}`;

  const areaColor = isSelected ? 'rgba(0, 136, 207, 0.2)' : 'url(#hatchPatternGray)';
  const endBlockOccupancyColor = isSelected ? SNCFCOLORS.red : SNCFCOLORS.coolgray9;
  const startBlockOccupancyColor = isSelected ? SNCFCOLORS.yellow : SNCFCOLORS.coolgray5;
  const tailPositionColor = isSelected ? SNCFCOLORS.cyan : SNCFCOLORS.coolgray3;
  const headPositionColor = isSelected ? SNCFCOLORS.blue : SNCFCOLORS.coolgray7;

  const initialDrag = rotate
    ? chart.y.invert(0)
    : chart.x.invert(0);
  let dragValue = 0;

  const drag = d3.drag()
    .on('end', () => {
      dispatch(updateMustRedraw(true));
    })
    .on('start', () => {
      dispatch(updateSelectedTrain(dataSimulation.trainNumber));
    })
    .on('drag', () => {
      dragValue += rotate ? d3.event.dy : d3.event.dx;
      const translation = rotate ? `0,${dragValue}` : `${dragValue},0`;
      d3.select(`#${groupID}`)
        .attr('transform', `translate(${translation})`);
      const value = rotate
        ? Math.floor((chart.y.invert(d3.event.dy) - initialDrag) / 1000)
        : Math.floor((chart.x.invert(d3.event.dx) - initialDrag) / 1000);
      setDragOffset(value);
    });

  chart.drawZone.append('g')
    .attr('id', groupID)
    .attr('class', 'chartTrain')
    .call(drag);

  drawArea(
    chart, areaColor, dataSimulation, dispatch, groupID, 'curveStepAfter', keyValues,
    'areaBlock', rotate,
  );
  drawCurve(chart, endBlockOccupancyColor, dataSimulation, groupID,
    'curveStepAfter', keyValues, 'endBlockOccupancy', rotate, isSelected);
  drawCurve(chart, startBlockOccupancyColor, dataSimulation, groupID,
    'curveStepAfter', keyValues, 'startBlockOccupancy', rotate, isSelected);
  drawCurve(chart, tailPositionColor, dataSimulation, groupID,
    'curveLinear', keyValues, 'tailPosition', rotate, isSelected);
  drawCurve(chart, headPositionColor, dataSimulation, groupID,
    'curveLinear', keyValues, 'headPosition', rotate, isSelected);
  drawText(chart, groupID, dataSimulation);
};

const createTrain = (keyValues, simulationTrains) => {
  // Prepare data
  const dataSimulation = simulationTrains.map((train, trainNumber) => {
    const dataSimulationTrain = {};
    dataSimulationTrain.name = train.name;
    dataSimulationTrain.trainNumber = trainNumber;
    dataSimulationTrain.headPosition = formatStepsWithTime(train, 'head_position');
    dataSimulationTrain.tailPosition = formatStepsWithTime(train, 'tail_position');
    dataSimulationTrain.endBlockOccupancy = formatStepsWithTime(train, 'end_block_occupancy');
    dataSimulationTrain.startBlockOccupancy = formatStepsWithTime(train, 'start_block_occupancy');
    dataSimulationTrain.areaBlock = mergeDatasArea(
      dataSimulationTrain.endBlockOccupancy, dataSimulationTrain.startBlockOccupancy, keyValues,
    );
    return dataSimulationTrain;
  });
  return dataSimulation;
};

export default function SpaceTimeChart() {
  const ref = useRef();
  const dispatch = useDispatch();
  const {
    hoverPosition, mustRedraw, selectedTrain, simulation, timePosition,
  } = useSelector((state) => state.osrdsimulation);
  const keyValues = ['time', 'value'];
  const [rotate, setRotate] = useState(false);
  const [isResizeActive, setResizeActive] = useState(false);
  const [dataSimulation, setDataSimulation] = useState(createTrain(keyValues, simulation.trains));
  const [chart, setChart] = useState(undefined);
  const [showModal, setShowModal] = useState('');
  const [dragOffset, setDragOffset] = useState(0);

  const handleKey = ({ key }) => {
    if (['+', '-'].includes(key)) {
      setShowModal(key);
    }
  };

  const offsetTimeByDragging = (offset) => {
    const trains = Array.from(simulation.trains);
    trains[selectedTrain] = {
      ...trains[selectedTrain],
      steps: timeShiftTrain(trains[selectedTrain].steps, offset),
      stops: timeShiftStops(trains[selectedTrain].stops, offset),
    };
    dispatch(updateSimulation({ ...simulation, trains }));
  };

  const toggleRotation = () => {
    d3.select(`#${CHART_ID}`).remove();
    setChart({ ...chart, x: chart.y, y: chart.x });
    setRotate(!rotate);
    dispatch(updateMustRedraw(true));
  };

  const drawAllTrains = () => {
    if (mustRedraw) {
      const chartLocal = createChart(
        chart, dataSimulation, keyValues, ref, rotate,
      );
      dataSimulation.forEach((train, idx) => {
        drawTrain(
          chartLocal, dispatch, train, (idx === selectedTrain),
          keyValues, offsetTimeByDragging, rotate, setDragOffset,
        );
      });
      enableInteractivity(
        chartLocal, dataSimulation[selectedTrain], dispatch, keyValues,
        LIST_VALUES_NAME_SPACE_TIME, rotate, setChart,
      );
      // findConflicts(chartLocal, dataSimulation, rotate);
      setChart(chartLocal);
      dispatch(updateChart({ ...chartLocal, rotate }));
      dispatch(updateMustRedraw(false));
    }
  };

  useEffect(() => {
    offsetTimeByDragging(dragOffset);
  }, [dragOffset]);

  useEffect(() => {
    setDataSimulation(createTrain(keyValues, simulation.trains));
    drawAllTrains();
    handleWindowResize(CHART_ID, dispatch, drawAllTrains, isResizeActive, setResizeActive);
  }, [mustRedraw, rotate, selectedTrain, simulation.trains[selectedTrain]]);

  useEffect(() => {
    traceVerticalLine(
      chart, dataSimulation[selectedTrain], hoverPosition, keyValues,
      LIST_VALUES_NAME_SPACE_TIME, 'headPosition', rotate, timePosition,
    );
  }, [chart, hoverPosition, mustRedraw, timePosition]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, []);

  return (
    <div id={`container-${CHART_ID}`} className="spacetime-chart w-100">
      {showModal !== ''
        ? (
          <ChartModal
            type={showModal}
            setShowModal={setShowModal}
            trainName={dataSimulation[selectedTrain].name}
            offsetTimeByDragging={offsetTimeByDragging}
          />
        )
        : null}
      <div ref={ref} />
      <button
        type="button"
        className="btn-rounded btn-rounded-white box-shadow btn-rotate"
        onClick={() => toggleRotation(rotate, setRotate)}
      >
        <i className="icons-refresh" />
      </button>
    </div>
  );
}
