import * as d3 from 'd3';

import React, { useEffect, useRef, useState } from 'react';
import enableInteractivity, {
  traceVerticalLine,
} from 'applications/osrd/components/Simulation/enableInteractivity';
import {
  handleWindowResize,
  interpolateOnTime,
  timeShiftTrain,
} from 'applications/osrd/components/Helpers/ChartHelpers';
import {
  updateChart,
  updateContextMenu,
  updateMustRedraw,
  updatePositionValues,
  updateSimulation,
} from 'reducers/osrdsimulation';
import { useDispatch, useSelector } from 'react-redux';

import { CgLoadbar } from 'react-icons/cg';
import ChartModal from 'applications/osrd/components/Simulation/ChartModal';
import { GiResize } from 'react-icons/gi';
import { LIST_VALUES_NAME_SPACE_TIME } from 'applications/osrd/components/Simulation/consts';
import PropTypes from 'prop-types';
import { changeTrain } from 'applications/osrd/components/TrainList/TrainListHelpers';
import createChart from 'applications/osrd/components/Simulation/SpaceTimeChart/createChart';
import createTrain from 'applications/osrd/components/Simulation/SpaceTimeChart/createTrain';
import drawTrain from 'applications/osrd/components/Simulation/SpaceTimeChart/drawTrain';
import { useTranslation } from 'react-i18next';

const CHART_ID = 'SpaceTimeChart';

const drawAxisTitle = (chart, rotate) => {
  chart.drawZone
    .append('text')
    .attr('class', 'axis-unit')
    .attr('text-anchor', 'end')
    .attr('transform', rotate ? 'rotate(0)' : 'rotate(-90)')
    .attr('x', rotate ? chart.width - 10 : -10)
    .attr('y', rotate ? chart.height - 10 : 20)
    .text('KM');
};

export default function SpaceTimeChart(props) {
  const { heightOfSpaceTimeChart } = props;
  const ref = useRef();
  const dispatch = useDispatch();
  const { t } = useTranslation(['allowances']);
  const {
    allowancesSettings,
    mustRedraw,
    positionValues,
    selectedProjection,
    selectedTrain,
    simulation,
    timePosition,
  } = useSelector((state) => state.osrdsimulation);
  const keyValues = ['time', 'position'];
  const [rotate, setRotate] = useState(false);
  const [isResizeActive, setResizeActive] = useState(false);
  const [chart, setChart] = useState(undefined);
  const [resetChart, setResetChart] = useState(false);
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
    const operationalPointsZone = chartLocal.drawZone
      .append('g')
      .attr('id', 'get-operationalPointsZone');
    simulation.trains[selectedTrain].base.stops.forEach((stop) => {
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
  };

  const drawAllTrains = (reset) => {
    if (mustRedraw) {
      const chartLocal = createChart(
        chart,
        CHART_ID,
        dataSimulation,
        heightOfSpaceTimeChart,
        keyValues,
        ref,
        reset,
        rotate
      );

      chartLocal.svg.on('click', () => {
        dispatch(updateContextMenu(undefined));
      });

      drawOPs(chartLocal);

      drawAxisTitle(chartLocal, rotate);
      dataSimulation.forEach((train, idx) => {
        drawTrain(
          chartLocal,
          dispatch,
          train,
          train.id === selectedProjection.id,
          idx === selectedTrain,
          keyValues,
          allowancesSettings,
          offsetTimeByDragging,
          rotate,
          setDragEnding,
          setDragOffset,
          simulation
        );
      });
      enableInteractivity(
        chartLocal,
        dataSimulation[selectedTrain],
        dispatch,
        keyValues,
        LIST_VALUES_NAME_SPACE_TIME,
        positionValues,
        rotate,
        setChart,
        setYPosition,
        setZoomLevel,
        yPosition,
        zoomLevel
      );
      // findConflicts(chartLocal, dataSimulation, rotate);
      setChart(chartLocal);
      dispatch(updateChart({ ...chartLocal, rotate }));
      dispatch(updateMustRedraw(false));
      setResetChart(false);
    }
  };

  useEffect(() => {
    setDataSimulation(createTrain(dispatch, keyValues, simulation.trains, t));
    setTimeout(() => {
      dispatch(updateMustRedraw(true));
    }, 0);
  }, []);

  useEffect(() => {
    // ADN, entire fonction operation is subject to one condition, so aopply this condition before OR write clear and first condition to return (do nothing)
    offsetTimeByDragging(dragOffset);
  }, [dragOffset]);

  useEffect(() => {
    if (dragEnding) {
      changeTrain(
        {
          departure_time: simulation.trains[selectedTrain].base.stops[0].time,
        },
        simulation.trains[selectedTrain].id
      );
      setDragEnding(false);
    }
  }, [dragEnding]);

  useEffect(() => {
    setDataSimulation(createTrain(dispatch, keyValues, simulation.trains, t));
    if (dataSimulation) {
      // ADN: No need to redo all this on a simple drag
      /* ADN drawAllTrain do something only if mustRedraw = true,
      so delete the condo in it and call if mustRadrw = true
      it is far more redable */
      // ADN drawAllTrain already traceVerticalLines
      drawAllTrains(resetChart);
      handleWindowResize(CHART_ID, dispatch, drawAllTrains, isResizeActive, setResizeActive);
    }
  }, [mustRedraw, rotate, selectedTrain, simulation.trains[selectedTrain]]);

  useEffect(() => {
    if (timePosition && dataSimulation && dataSimulation[selectedTrain]) {
      // ADN: too heavy, dispatch on release (dragEnd), careful with dispatch !
      const newPositionValues = interpolateOnTime(
        dataSimulation[selectedTrain],
        keyValues,
        LIST_VALUES_NAME_SPACE_TIME,
        timePosition
      );
      dispatch(updatePositionValues(newPositionValues));
    }
  }, [chart, mustRedraw]);

  useEffect(() => {
    if (dataSimulation) {
      traceVerticalLine(
        chart,
        dataSimulation[selectedTrain],
        keyValues,
        LIST_VALUES_NAME_SPACE_TIME,
        positionValues,
        'headPosition',
        rotate,
        timePosition
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
    <div
      id={`container-${CHART_ID}`}
      className="spacetime-chart w-100"
      style={{ height: `${heightOfSpaceTimeChart}px` }}
    >
      {showModal !== '' ? (
        <ChartModal
          type={showModal}
          setShowModal={setShowModal}
          trainName={dataSimulation[selectedTrain].name}
          offsetTimeByDragging={offsetTimeByDragging}
        />
      ) : null}
      <div ref={ref} />
      <button
        type="button"
        className="btn-rounded btn-rounded-white box-shadow btn-rotate"
        onClick={() => toggleRotation(rotate, setRotate)}
      >
        <i className="icons-refresh" />
      </button>
      <button
        type="button"
        className="btn-rounded btn-rounded-white box-shadow btn-rotate mr-5"
        onClick={() => {
          setResetChart(true);
          dispatch(updateMustRedraw(true));
        }}
      >
        <GiResize />
      </button>
      <div className="handle-tab-resize">
        <CgLoadbar />
      </div>
    </div>
  );
}

SpaceTimeChart.propTypes = {
  heightOfSpaceTimeChart: PropTypes.number.isRequired,
};
