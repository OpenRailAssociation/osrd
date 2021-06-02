import React, {
  useState, useEffect, useRef,
} from 'react';
import PropTypes from 'prop-types';
import * as d3 from 'd3';
import { LIST_VALUES_NAME_SPACE_TIME } from 'applications/osrd/components/Simulation/consts';
import { SNCFCOLORS } from 'applications/osrd/consts';
import {
  defineLinear, defineTime, formatStepsWithTime,
  handleWindowResize, mergeDatasArea,
} from 'applications/osrd/components/Helpers/ChartHelpers';
import ChartModal from 'applications/osrd/components/Simulation/ChartModal';
import defineChart from 'applications/osrd/components/Simulation/defineChart';
import drawCurve from 'applications/osrd/components/Simulation/drawCurve';
import drawArea from 'applications/osrd/components/Simulation/drawArea';
import drawText from 'applications/osrd/components/Simulation/drawText';
import findConflicts from 'applications/osrd/components/Simulation/findConflicts';
import enableInteractivity, { traceVerticalLine } from 'applications/osrd/components/Simulation/enableInteractivity';

const CHART_ID = 'SpaceTimeChart';

const createChart = (chart, dataSimulation, keyValues, ref) => {
  d3.select(`#${CHART_ID}`).remove();

  const dataSimulationTime = d3.extent([].concat(...dataSimulation.map(
    (train) => d3.extent(train.headPosition, (d) => d[keyValues[0]]),
  )));

  const dataSimulationLinearMax = d3.max([
    d3.max([].concat(...dataSimulation.map(
      (train) => d3.max(train.brakingDistance.map((step) => step[keyValues[1]])),
    ))),
    d3.max([].concat(...dataSimulation.map(
      (train) => d3.max(train.currentBlocksection.map((step) => step[keyValues[1]])),
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
  const chartLocal = defineChart(width, 300, defineX, defineY, ref, CHART_ID);
  return (chart === undefined)
    ? chartLocal
    : { ...chartLocal, x: chart.x, y: chart.y };
};

const drawTrain = (
  chart, dataSimulation, isSelected, keyValues, offsetTimeByDragging,
  rotate, setMustRedraw, setSelectedTrain,
) => {
  const groupID = `spaceTime-${dataSimulation.name}`;

  const areaColor = isSelected ? 'rgba(0, 136, 207, 0.2)' : 'url(#hatchPatternGray)';
  const brakingDistanceColor = isSelected ? SNCFCOLORS.red : SNCFCOLORS.coolgray9;
  const currentBlocksectionColor = isSelected ? SNCFCOLORS.yellow : SNCFCOLORS.coolgray5;
  const tailPositionColor = isSelected ? SNCFCOLORS.cyan : SNCFCOLORS.coolgray3;
  const headPositionColor = isSelected ? SNCFCOLORS.blue : SNCFCOLORS.coolgray7;

  const initialDrag = rotate
    ? chart.y.invert(0)
    : chart.x.invert(0);
  let dragValue = 0;

  const drag = d3.drag()
    .on('end', () => {
      setMustRedraw(true);
    })
    .on('start', () => {
      setSelectedTrain(dataSimulation.trainNumber);
    })
    .on('drag', () => {
      dragValue += rotate ? d3.event.dy : d3.event.dx;
      const translation = rotate ? `0,${dragValue}` : `${dragValue},0`;
      d3.select(`#${groupID}`)
        .attr('transform', `translate(${translation})`);
      const value = rotate
        ? Math.floor((chart.y.invert(d3.event.dy) - initialDrag) / 1000)
        : Math.floor((chart.x.invert(d3.event.dx) - initialDrag) / 1000);
      offsetTimeByDragging(value, dataSimulation.trainNumber);
    });

  chart.drawZone.append('g')
    .attr('id', groupID)
    .attr('class', 'chartTrain')
    .call(drag);

  drawArea(
    chart, areaColor, dataSimulation, groupID, 'curveStepAfter', keyValues,
    'areaBlock', rotate, setMustRedraw, setSelectedTrain,
  );
  drawCurve(chart, brakingDistanceColor, dataSimulation, groupID,
    'curveStepAfter', keyValues, 'brakingDistance', rotate, isSelected);
  drawCurve(chart, currentBlocksectionColor, dataSimulation, groupID,
    'curveStepAfter', keyValues, 'currentBlocksection', rotate, isSelected);
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
    dataSimulationTrain.headPosition = formatStepsWithTime(train, 'headPosition');
    dataSimulationTrain.tailPosition = formatStepsWithTime(train, 'tailPosition');
    dataSimulationTrain.brakingDistance = formatStepsWithTime(train, 'brakingDistance');
    dataSimulationTrain.currentBlocksection = formatStepsWithTime(train, 'currentBlocksection');
    dataSimulationTrain.areaBlock = mergeDatasArea(
      dataSimulationTrain.brakingDistance, dataSimulationTrain.currentBlocksection, keyValues,
    );
    return dataSimulationTrain;
  });
  return dataSimulation;
};

const SpaceTimeChart = (props) => {
  const {
    hoverPosition, mustRedraw, offsetTimeByDragging, selectedTrain,
    setHoverPosition, setMustRedraw, setSelectedTrain, simulation,
  } = props;
  const ref = useRef();
  const keyValues = ['time', 'value'];
  const [rotate, setRotate] = useState(false);
  const [isResizeActive, setResizeActive] = useState(false);
  const [dataSimulation, setDataSimulation] = useState(createTrain(keyValues, simulation.trains));
  const [chart, setChart] = useState(undefined);
  const [showModal, setShowModal] = useState('');

  const handleKey = ({ key }) => {
    if (['+', '-'].includes(key)) {
      setShowModal(key);
    }
  };

  const toggleRotation = () => {
    d3.select(`#${CHART_ID}`).remove();
    setChart({ ...chart, x: chart.y, y: chart.x });
    setRotate(!rotate);
    setMustRedraw(true);
  };

  const drawAllTrains = () => {
    if (mustRedraw) {
      const chartLocal = createChart(
        chart, dataSimulation, keyValues, ref,
      );
      dataSimulation.forEach((train, idx) => {
        drawTrain(
          chartLocal, train, (idx === selectedTrain), keyValues,
          offsetTimeByDragging, rotate, setMustRedraw, setSelectedTrain,
        );
      });
      enableInteractivity(
        chartLocal, dataSimulation[selectedTrain], keyValues,
        LIST_VALUES_NAME_SPACE_TIME, rotate, setChart, setHoverPosition,
        setMustRedraw,
      );
      findConflicts(chartLocal, dataSimulation, rotate);
      setChart(chartLocal);
      setMustRedraw(false);
    }
  };

  useEffect(() => {
    setDataSimulation(createTrain(keyValues, simulation.trains));
    drawAllTrains();
    handleWindowResize(CHART_ID, drawAllTrains, isResizeActive, setResizeActive, setMustRedraw);
  }, [mustRedraw, rotate, selectedTrain, simulation.trains[selectedTrain]]);

  useEffect(() => {
    traceVerticalLine(
      chart, dataSimulation[selectedTrain], hoverPosition, keyValues, LIST_VALUES_NAME_SPACE_TIME, 'headPosition', rotate,
    );
  }, [mustRedraw, hoverPosition, chart]);

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
            selectedTrain={selectedTrain}
            setMustRedraw={setMustRedraw}
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
};

SpaceTimeChart.propTypes = {
  simulation: PropTypes.object.isRequired,
  hoverPosition: PropTypes.number,
  mustRedraw: PropTypes.bool.isRequired,
  setHoverPosition: PropTypes.func.isRequired,
  selectedTrain: PropTypes.number.isRequired,
  setMustRedraw: PropTypes.func.isRequired,
  setSelectedTrain: PropTypes.func.isRequired,
  offsetTimeByDragging: PropTypes.func.isRequired,
};
SpaceTimeChart.defaultProps = {
  hoverPosition: undefined,
};

export default SpaceTimeChart;
