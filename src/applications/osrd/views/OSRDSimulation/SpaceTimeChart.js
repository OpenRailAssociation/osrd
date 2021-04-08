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
  const chartLocal = defineChart(width, 400, defineX, defineY, ref, CHART_ID);
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

  chart.drawZone.append('g').attr('id', groupID).attr('class', 'chartTrain');
  drawArea(
    chart, areaColor, dataSimulation, groupID, 'curveStepAfter', keyValues,
    'areaBlock', offsetTimeByDragging, rotate, setMustRedraw, setSelectedTrain,
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
    hoverPosition, offsetTimeByDragging, selectedTrain,
    setHoverPosition, setSelectedTrain, simulation,
  } = props;
  const ref = useRef();
  const keyValues = ['time', 'value'];
  const [rotate, setRotate] = useState(false);
  const [isResizeActive, setResizeActive] = useState(false);
  const [dataSimulation, setDataSimulation] = useState(createTrain(keyValues, simulation.trains));
  const [chart, setChart] = useState(undefined);
  const [mustRedraw, setMustRedraw] = useState(true);
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
    <div className="row w-100">
      <div className="col-9 w-100">
        <div id={`container-${CHART_ID}`}>
          {showModal !== ''
            ? (
              <ChartModal
                type={showModal}
                setShowModal={setShowModal}
                trainName={dataSimulation[selectedTrain].name}
                offsetTimeByDragging={offsetTimeByDragging}
                setMustRedraw={setMustRedraw}
              />
            )
            : null}
          <div ref={ref} />
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => toggleRotation(rotate, setRotate)}
        >
          Rotation
        </button>
      </div>
      <div className="col-3">
        <p className="font-weight-bold lead">
          {dataSimulation[selectedTrain].name}
        </p>
        { hoverPosition !== undefined
          && dataSimulation[selectedTrain].headPosition[hoverPosition] !== undefined
          ? (
            <>
              <p className="font-weight-bold lead">
                <i className="icons-clock mr-2" />
                {dataSimulation[selectedTrain].headPosition[hoverPosition].time.toLocaleTimeString('fr-FR')}
              </p>
              <div>
                <span className="small font-weight-bold text-blue mr-2">TÊTE</span>
                {Math.round(dataSimulation[selectedTrain].headPosition[hoverPosition].value) / 1000}
                km
              </div>
              <div>
                <span className="small font-weight-bold text-cyan mr-2">QUEUE</span>
                {Math.round(dataSimulation[selectedTrain].tailPosition[hoverPosition].value) / 1000}
                km
              </div>
              <div>
                <span className="small font-weight-bold text-danger mr-2">FREINAGE</span>
                {Math.round(
                  dataSimulation[selectedTrain].brakingDistance[hoverPosition].value,
                ) / 1000}
                km
              </div>
              <div>
                <span className="small font-weight-bold text-orange mr-2">BLOCK</span>
                {Math.round(
                  dataSimulation[selectedTrain].currentBlocksection[hoverPosition].value,
                ) / 1000}
                km
              </div>
              <div>
                <span className="small font-weight-bold text-secondary mr-2">CANTON</span>
                {Math.round(
                  dataSimulation[selectedTrain].brakingDistance[hoverPosition].value
                  - dataSimulation[selectedTrain].currentBlocksection[hoverPosition].value,
                ) / 1000}
                km
              </div>
              <p>
                <span className="small font-weight-bold text-pink mr-2">VITESSE</span>
                {Math.round(simulation.trains[selectedTrain].steps[hoverPosition].speed * 3.6)}
                km/h
              </p>
              <p>
                {simulation.trains[selectedTrain].steps[hoverPosition].state}
              </p>
            </>
          ) : null }
      </div>
    </div>
  );
};

SpaceTimeChart.propTypes = {
  simulation: PropTypes.object.isRequired,
  hoverPosition: PropTypes.number,
  setHoverPosition: PropTypes.func.isRequired,
  selectedTrain: PropTypes.number.isRequired,
  setSelectedTrain: PropTypes.func.isRequired,
  offsetTimeByDragging: PropTypes.func.isRequired,
};
SpaceTimeChart.defaultProps = {
  hoverPosition: undefined,
};

export default SpaceTimeChart;
