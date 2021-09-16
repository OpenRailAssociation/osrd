import React, {
  useState, useEffect, useRef,
} from 'react';
import { useSelector, useDispatch } from 'react-redux';
import * as d3 from 'd3';
import { LIST_VALUES_NAME_SPACE_TIME } from 'applications/osrd/components/Simulation/consts';
import {
  defineLinear, defineTime, formatStepsWithTime, formatStepsWithTimeMulti, getDirection,
  handleWindowResize, interpolator, makeStairCase, mergeDatasArea, timeShiftTrain, timeShiftStops,
} from 'applications/osrd/components/Helpers/ChartHelpers';
import {
  updateChart, updateMustRedraw, updatePositionValues, updateSimulation, updateSelectedTrain,
} from 'reducers/osrdsimulation';
import ChartModal from 'applications/osrd/components/Simulation/ChartModal';
import defineChart from 'applications/osrd/components/Simulation/defineChart';
import drawCurve from 'applications/osrd/components/Simulation/drawCurve';
import drawArea from 'applications/osrd/components/Simulation/drawArea';
import drawText from 'applications/osrd/components/Simulation/drawText';
import findConflicts from 'applications/osrd/components/Simulation/findConflicts';
import enableInteractivity, { traceVerticalLine } from 'applications/osrd/components/Simulation/enableInteractivity';

const CHART_ID = 'SpaceTimeChart';

const drawAxisTitle = (chart, rotate) => {
  chart.drawZone.append('text')
    .attr('class', 'axis-unit')
    .attr('text-anchor', 'end')
    .attr('transform', rotate ? 'rotate(0)' : 'rotate(-90)')
    .attr('x', rotate ? chart.width - 10 : -10)
    .attr('y', rotate ? chart.height - 10 : 20)
    .text('KM');
};

const createChart = (chart, dataSimulation, keyValues, ref, rotate) => {
  d3.select(`#${CHART_ID}`).remove();

  const dataSimulationTime = d3.extent([].concat(...dataSimulation.map(
    (train) => d3.extent(train.routeBeginOccupancy, (d) => d[keyValues[0]]),
  )));

  const dataSimulationLinearMax = d3.max([
    d3.max([].concat(...dataSimulation.map(
      (train) => d3.max(train.routeEndOccupancy.map((step) => step[keyValues[1]])),
    ))),
    d3.max([].concat(...dataSimulation.map(
      (train) => d3.max(train.routeBeginOccupancy.map((step) => step[keyValues[1]])),
    ))),
    /* d3.max([].concat(...dataSimulation.map(
      (train) => d3.max(train.headPosition.map((step) => step[keyValues[1]])),
    ))),
    d3.max([].concat(...dataSimulation.map(
      (train) => d3.max(train.tailPosition.map((step) => step[keyValues[1]])),
    ))), */
  ]);

  const defineX = (chart === undefined)
    ? defineTime(dataSimulationTime, keyValues[0])
    : chart.x;
  const defineY = (chart === undefined)
    ? defineLinear(dataSimulationLinearMax, 0.05)
    : chart.y;

  const width = parseInt(d3.select(`#container-${CHART_ID}`).style('width'), 10);
  const chartLocal = defineChart(width, 400, defineX, defineY, ref, rotate, keyValues, CHART_ID);
  return (chart === undefined)
    ? chartLocal
    : { ...chartLocal, x: chart.x, y: chart.y };
};

const drawTrain = (
  chart, dispatch, dataSimulation, isSelected, keyValues,
  offsetTimeByDragging, rotate, setDragOffset,
) => {
  const groupID = `spaceTime-${dataSimulation.trainNumber}`;

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

  // Test direction to avoid displaying block
  const direction = getDirection(dataSimulation.headPosition);

  if (direction) {
    drawArea(
      chart, `${isSelected ? 'selected' : ''} area`, dataSimulation, dispatch, groupID, 'curveStepAfter', keyValues,
      'areaBlock', rotate,
    );
    drawCurve(chart, `${isSelected ? 'selected' : ''} end-block`, dataSimulation.routeEndOccupancy, groupID,
      'curveLinear', keyValues, 'routeEndOccupancy', rotate, isSelected);
    drawCurve(chart, `${isSelected ? 'selected' : ''} start-block`, dataSimulation.routeBeginOccupancy, groupID,
      'curveLinear', keyValues, 'routeBeginOccupancy', rotate, isSelected);
  }

  dataSimulation.tailPosition.forEach((tailPositionSection) => drawCurve(
    chart, `${isSelected ? 'selected' : ''} tail`, tailPositionSection, groupID,
    'curveLinear', keyValues, 'tailPosition', rotate, isSelected,
  ));
  dataSimulation.headPosition.forEach((headPositionSection) => drawCurve(
    chart, `${isSelected ? 'selected' : ''} head`, headPositionSection, groupID,
    'curveLinear', keyValues, 'headPosition', rotate, isSelected,
  ));
  drawText(chart, groupID, dataSimulation);
};

const createTrain = (keyValues, simulationTrains) => {
  // Prepare data
  const dataSimulation = simulationTrains.map((train, trainNumber) => {
    const dataSimulationTrain = {};
    dataSimulationTrain.name = train.name;
    dataSimulationTrain.trainNumber = trainNumber;
    dataSimulationTrain.headPosition = formatStepsWithTimeMulti(train.head_positions);
    dataSimulationTrain.tailPosition = formatStepsWithTimeMulti(train.tail_positions);
    dataSimulationTrain.routeEndOccupancy = formatStepsWithTime(
      makeStairCase(train.route_end_occupancy),
    );
    dataSimulationTrain.routeBeginOccupancy = formatStepsWithTime(
      makeStairCase(train.route_begin_occupancy),
    );
    dataSimulationTrain.areaBlock = mergeDatasArea(
      dataSimulationTrain.routeEndOccupancy, dataSimulationTrain.routeBeginOccupancy, keyValues,
    );
    return dataSimulationTrain;
  });
  return dataSimulation;
};

export default function SpaceTimeChart() {
  const ref = useRef();
  const dispatch = useDispatch();
  const {
    mustRedraw, positionValues, selectedTrain, simulation, timePosition,
  } = useSelector((state) => state.osrdsimulation);
  const keyValues = ['time', 'position'];
  const [rotate, setRotate] = useState(false);
  const [isResizeActive, setResizeActive] = useState(false);
  const [chart, setChart] = useState(undefined);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [yPosition, setYPosition] = useState(0);
  const [dataSimulation, setDataSimulation] = useState(createTrain(keyValues, simulation.trains));
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
      drawAxisTitle(chartLocal, rotate);
      dataSimulation.forEach((train, idx) => {
        drawTrain(
          chartLocal, dispatch, train, (idx === selectedTrain),
          keyValues, offsetTimeByDragging, rotate, setDragOffset,
        );
      });
      enableInteractivity(
        chartLocal, dataSimulation[selectedTrain], dispatch, keyValues,
        LIST_VALUES_NAME_SPACE_TIME, positionValues, rotate,
        setChart, setYPosition, setZoomLevel, yPosition, zoomLevel,
      );
      // findConflicts(chartLocal, dataSimulation, rotate);
      setChart(chartLocal);
      dispatch(updateChart({ ...chartLocal, rotate }));
      dispatch(updateMustRedraw(false));
    }
  };

  useEffect(() => {
    dispatch(updateMustRedraw(true));
  }, []);

  useEffect(() => {
    if (dragOffset !== 0) {
      offsetTimeByDragging(dragOffset);
    }
  }, [dragOffset]);

  useEffect(() => {
    setDataSimulation(createTrain(keyValues, simulation.trains));
    drawAllTrains();
    handleWindowResize(CHART_ID, dispatch, drawAllTrains, isResizeActive, setResizeActive);
  }, [mustRedraw, rotate, selectedTrain, simulation.trains[selectedTrain]]);

  useEffect(() => {
    if (timePosition) {
      dispatch(updatePositionValues(
        interpolator(
          dataSimulation[selectedTrain], keyValues, LIST_VALUES_NAME_SPACE_TIME, timePosition,
        ),
      ));
      traceVerticalLine(
        chart, dataSimulation[selectedTrain], keyValues,
        LIST_VALUES_NAME_SPACE_TIME, positionValues, 'headPosition', rotate, timePosition,
      );
    }
  }, [chart, mustRedraw, timePosition]);

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
