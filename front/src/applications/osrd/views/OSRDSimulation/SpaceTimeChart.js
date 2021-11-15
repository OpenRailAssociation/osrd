import React, {
  useState, useEffect, useRef,
} from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import * as d3 from 'd3';
import { LIST_VALUES_NAME_SPACE_TIME } from 'applications/osrd/components/Simulation/consts';
import { handleWindowResize, interpolateOnTime, timeShiftTrain } from 'applications/osrd/components/Helpers/ChartHelpers';
import {
  updateChart, updateContextMenu, updateMustRedraw,
  updatePositionValues, updateSimulation,
} from 'reducers/osrdsimulation';
import ChartModal from 'applications/osrd/components/Simulation/ChartModal';
import enableInteractivity, { traceVerticalLine } from 'applications/osrd/components/Simulation/enableInteractivity';
import { changeTrain } from 'applications/osrd/components/TrainList/TrainListHelpers';
import createChart from 'applications/osrd/components/Simulation/SpaceTimeChart/createChart';
import createTrain from 'applications/osrd/components/Simulation/SpaceTimeChart/createTrain';
import drawTrain from 'applications/osrd/components/Simulation/SpaceTimeChart/drawTrain';

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

export default function SpaceTimeChart() {
  const ref = useRef();
  const dispatch = useDispatch();
  const { t } = useTranslation(['margins']);
  const {
    marginsSettings, mustRedraw, positionValues, selectedTrain, simulation, timePosition,
  } = useSelector((state) => state.osrdsimulation);
  const keyValues = ['time', 'position'];
  const [rotate, setRotate] = useState(false);
  const [isResizeActive, setResizeActive] = useState(false);
  const [chart, setChart] = useState(undefined);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [yPosition, setYPosition] = useState(0);
  const [dataSimulation, setDataSimulation] = useState(undefined);
  const [showModal, setShowModal] = useState('');
  const [dragOffset, setDragOffset] = useState(0);
  const [dragEnding, setDragEnding] = useState(false);

  const handleKey = ({ key }) => {
    if (['+', '-'].includes(key)) {
      setShowModal(key);
    }
  };

  const offsetTimeByDragging = (offset) => {
    const trains = Array.from(simulation.trains);
    trains[selectedTrain] = timeShiftTrain(trains[selectedTrain], offset);
    dispatch(updateSimulation({ ...simulation, trains }));
  };

  const toggleRotation = () => {
    d3.select(`#${CHART_ID}`).remove();
    setChart({ ...chart, x: chart.y, y: chart.x });
    setRotate(!rotate);
    dispatch(updateMustRedraw(true));
  };

  const drawOPs = (chartLocal) => {
    const operationalPointsZone = chartLocal.drawZone.append('g').attr('id', 'get-operationalPointsZone');
    simulation.trains[selectedTrain].base.stops.forEach((stop) => {
      operationalPointsZone.append('line')
        .attr('id', `op-${stop.id}`)
        .attr('class', 'op-line')
        .attr('x1', 0)
        .attr('y1', chartLocal.y(stop.position))
        .attr('x2', chartLocal.width)
        .attr('y2', chartLocal.y(stop.position));
      operationalPointsZone.append('text')
        .attr('class', 'op-text')
        .text(`${stop.name}`)
        .attr('x', 0)
        .attr('y', chartLocal.y(stop.position))
        .attr('text-anchor', 'center')
        .attr('dx', 5)
        .attr('dy', -5);
    });
  };

  const drawAllTrains = () => {
    if (mustRedraw) {
      const chartLocal = createChart(
        chart, CHART_ID, dataSimulation, keyValues, ref, rotate,
      );

      chartLocal.svg.on('click', () => {
        dispatch(updateContextMenu(undefined));
      });

      drawOPs(chartLocal);

      drawAxisTitle(chartLocal, rotate);
      dataSimulation.forEach((train, idx) => {
        drawTrain(
          chartLocal, dispatch, train, (idx === selectedTrain), keyValues, marginsSettings,
          offsetTimeByDragging, rotate, setDragEnding, setDragOffset,
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
    setDataSimulation(createTrain(dispatch, keyValues, simulation.trains, t));
    setTimeout(() => {
      dispatch(updateMustRedraw(true));
    }, 0);
  }, []);

  useEffect(() => {
    if (dragOffset !== 0) {
      offsetTimeByDragging(dragOffset);
    }
  }, [dragOffset]);

  useEffect(() => {
    if (dragEnding) {
      changeTrain({
        departure_time: simulation.trains[selectedTrain].base.stops[0].time,
      }, simulation.trains[selectedTrain].id);
      setDragEnding(false);
    }
  }, [dragEnding]);

  useEffect(() => {
    setDataSimulation(createTrain(dispatch, keyValues, simulation.trains, t));
    if (dataSimulation) {
      drawAllTrains();
      handleWindowResize(CHART_ID, dispatch, drawAllTrains, isResizeActive, setResizeActive);
    }
  }, [mustRedraw, rotate, selectedTrain, simulation.trains[selectedTrain]]);

  useEffect(() => {
    if (timePosition && dataSimulation && dataSimulation[selectedTrain]) {
      dispatch(updatePositionValues(
        interpolateOnTime(
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
    if (dataSimulation) {
      traceVerticalLine(
        chart, dataSimulation[selectedTrain], keyValues,
        LIST_VALUES_NAME_SPACE_TIME, positionValues, 'headPosition', rotate, timePosition,
      );
    }
  }, [positionValues]);

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
