import * as d3 from 'd3';

import React, { useEffect, useRef, useState } from 'react';
import enableInteractivity, {
  traceVerticalLine,
} from 'applications/customget/components/enableInteractivity';
import { interpolateOnTime, timeShiftTrain } from 'applications/customget/components/ChartHelpers';
import {
  updateChart,
  updateContextMenu,
  updateMustRedraw,
  updatePositionValues,
} from 'reducers/osrdsimulation/actions';
import { useDispatch, useSelector } from 'react-redux';

import { CgLoadbar } from 'react-icons/cg';
import ChartModal from 'applications/customget/components/ChartModal';
import { GiResize } from 'react-icons/gi';
import { LIST_VALUES_NAME_SPACE_TIME } from 'applications/customget/components/consts';
import PropTypes from 'prop-types';
import createChart from 'applications/customget/components/SpaceTimeChart/createChart';
import createTrain from 'applications/customget/components/SpaceTimeChart/createTrain';
import drawTrain from 'applications/customget/components/SpaceTimeChart/drawTrain';
import { persistentUpdateSimulation } from 'reducers/osrdsimulation/simulation';
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

export default function DeprecatedSpaceTimeChart(props) {
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
    timePosition,
    consolidatedSimulation,
  } = useSelector((state) => state.osrdsimulation);
  const simulation = useSelector((state) => state.osrdsimulation.simulation.present);
  const keyValues = ['time', 'position'];
  const [rotate, setRotate] = useState(false);
  const [chart, setChart] = useState(undefined);
  const [resetChart, setResetChart] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [yPosition, setYPosition] = useState(0);
  const [dataSimulation, setDataSimulation] = useState(undefined);
  const [showModal, setShowModal] = useState('');
  const [dragOffset, setDragOffset] = useState(0);
  const [, setDragEnding] = useState(false);

  const handleKey = ({ key }) => {
    if (['+', '-'].includes(key)) {
      setShowModal(key);
    }
  };

  const offsetTimeByDragging = (offset) => {
    const trains = Array.from(simulation.trains);
    trains[selectedTrain] = timeShiftTrain(trains[selectedTrain], offset);
    dispatch(persistentUpdateSimulation({ ...simulation, trains }));
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

  const drawAllTrains = (reset, forceRedraw = false, newDataSimulation = undefined) => {
    const currentDataSimulation = newDataSimulation || dataSimulation;

    if (mustRedraw || forceRedraw) {
      const chartLocal = createChart(
        chart,
        CHART_ID,
        currentDataSimulation,
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
      currentDataSimulation.forEach((train, idx) => {
        drawTrain(
          chartLocal,
          dispatch,
          train,
          train.id === selectedProjection?.id,
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
        currentDataSimulation[selectedTrain],
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // ADN, entire fonction operation is subject to one condition, so aopply this condition before OR write clear and first condition to return (do nothing)
    offsetTimeByDragging(dragOffset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragOffset]);

  useEffect(() => {
    setResetChart(true);
  }, [consolidatedSimulation]);

  useEffect(() => {
    setDataSimulation(createTrain(dispatch, keyValues, simulation.trains, t));
    if (dataSimulation) {
      drawAllTrains(resetChart);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mustRedraw, rotate, selectedTrain, consolidatedSimulation]);

  // ADN: trigger a redraw on every simulation change. This is the right pattern.
  useEffect(() => {
    setDataSimulation(createTrain(dispatch, keyValues, simulation.trains, t));
    const newDataSimulation = createTrain(dispatch, keyValues, simulation.trains, t);
    if (dataSimulation) {
      // ADN drawAllTrain already traceVerticalLines

      drawAllTrains(resetChart, true, newDataSimulation);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulation.trains]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionValues]);

  useEffect(() => {
    let timeOutFunctionId;
    const timeOutResize = () => {
      clearTimeout(timeOutFunctionId);
      timeOutFunctionId = setTimeout(() => dispatch(updateMustRedraw(true)), 500);
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('resize', timeOutResize);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', timeOutResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

DeprecatedSpaceTimeChart.propTypes = {
  heightOfSpaceTimeChart: PropTypes.number.isRequired,
};
