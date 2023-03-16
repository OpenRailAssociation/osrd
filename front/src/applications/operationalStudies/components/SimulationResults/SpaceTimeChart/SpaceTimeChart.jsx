import * as d3 from 'd3';
import { noop } from 'lodash';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  isolatedEnableInteractivity,
  updatePointers,
  displayGuide,
} from 'applications/operationalStudies/components/SimulationResults/ChartHelpers/enableInteractivity';
import { Rnd } from 'react-rnd';
import {
  timeShiftTrain,
  interpolateOnTime,
} from 'applications/operationalStudies/components/SimulationResults/ChartHelpers/ChartHelpers';
import ORSD_GRAPH_SAMPLE_DATA from 'applications/operationalStudies/components/SimulationResults/SpeedSpaceChart/sampleData';
import { CgLoadbar } from 'react-icons/cg';
import ChartModal from 'applications/operationalStudies/components/SimulationResults/ChartModal';
import { GiResize } from 'react-icons/gi';
import {
  KEY_VALUES_FOR_SPACE_TIME_CHART,
  LIST_VALUES_NAME_SPACE_TIME,
} from 'applications/operationalStudies/components/SimulationResults/simulationResultsConsts';
import PropTypes from 'prop-types';
import { isolatedCreateTrain as createTrain } from 'applications/operationalStudies/components/SimulationResults/SpaceTimeChart/createTrain';

import { drawAllTrains } from 'applications/operationalStudies/components/SimulationResults/SpaceTimeChart/d3Helpers';
import { updateTimePositionValues } from 'reducers/osrdsimulation/actions';

const CHART_ID = 'SpaceTimeChart';
const CHART_MIN_HEIGHT = 250;

/**
 * @summary A Important chart to study evolution of trains vs time and inside block occupancies
 *
 * @version 1.0
 *
 * Features:
 * - Possible to slide a train and update its departure time
 * - Type " + " or " - " to update departure time by second
 * - use ctrl + third mouse button to zoom it / out
 * - use shift + hold left mouse button to pan
 * - Right-Bottom bottom to switch Scales
 * - Resize vertically
 *
 */
export default function SpaceTimeChart(props) {
  const ref = useRef();
  const rndContainerRef = useRef(null);

  const {
    allowancesSettings,
    dispatchUpdateChart,
    dispatchUpdateDepartureArrivalTimes,
    dispatchUpdateMustRedraw,
    dispatchUpdateSelectedTrain,
    dispatchUpdateTimePositionValues,
    initialHeightOfSpaceTimeChart,
    inputSelectedTrain,
    onOffsetTimeByDragging,
    onSetBaseHeightOfSpaceTimeChart,
    positionValues,
    selectedProjection,
    simulation,
    simulationIsPlaying,
    timePosition,
  } = props;

  const [baseHeightOfSpaceTimeChart, setBaseHeightOfSpaceTimeChart] = useState(
    initialHeightOfSpaceTimeChart
  );
  const [chart, setChart] = useState(undefined);
  const [dragOffset, setDragOffset] = useState(0);
  const [heightOfSpaceTimeChart, setHeightOfSpaceTimeChart] = useState(
    initialHeightOfSpaceTimeChart
  );
  const [resetChart, setResetChart] = useState(false);
  const [rotate, setRotate] = useState(false);
  const [selectedTrain, setSelectedTrain] = useState(inputSelectedTrain);
  const [localTime, setLocalTime] = useState(new Date());
  const [, setLocalPosition] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [showModal, setShowModal] = useState('');
  const [trainSimulations, setTrainSimulations] = useState(undefined);

  const dragShiftTrain = useCallback(
    (offset) => {
      if (trainSimulations) {
        const trains = trainSimulations.map((train, ind) =>
          ind === selectedTrain ? timeShiftTrain(train, offset) : train
        );
        setTrainSimulations(trains);
        onOffsetTimeByDragging(trains, offset);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trainSimulations, selectedTrain, onOffsetTimeByDragging]
  );

  const moveGridLinesOnMouseMove = useCallback(() => {
    if (chart?.svg) {
      const verticalMark = mousePos.x;
      const horizontalMark = mousePos.y;
      chart.svg.selectAll('#vertical-line').attr('x1', verticalMark).attr('x2', verticalMark);
      chart.svg.selectAll('#horizontal-line').attr('y1', horizontalMark).attr('y2', horizontalMark);
    }
  }, [chart, rotate, mousePos]);

  /**
   * INPUT UPDATES
   *
   * take into account an input update
   */
  useEffect(() => {
    setTrainSimulations(simulation.trains);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulation.trains]);

  useEffect(() => {
    // avoid useless re-render if selectedTrain is already correct
    if (selectedTrain !== inputSelectedTrain) {
      setSelectedTrain(inputSelectedTrain);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputSelectedTrain]);

  /**
   * ACTIONS HANDLE
   *
   * everything should be done by Hoc, has no direct effect on Comp behavior
   */
  const toggleRotation = () => {
    setChart({ ...chart, x: chart.y, y: chart.x });
    setRotate(!rotate);
  };

  /*
   * shift the train after a drag and drop
   * dragOffset is in Seconds !! (typecript is nice)
   */
  useEffect(() => {
    dragShiftTrain(dragOffset);
    const offsetLocalTime = new Date(1900, localTime.getMonth(), localTime.getDay());
    offsetLocalTime.setHours(localTime.getHours());
    offsetLocalTime.setMinutes(localTime.getMinutes());
    offsetLocalTime.setSeconds(localTime.getSeconds() + dragOffset);
    if (chart)
      setMousePos({
        ...mousePos,
        x: rotate ? mousePos.x : chart.x(offsetLocalTime),
        y: rotate ? chart.y(offsetLocalTime) : mousePos.y,
      });
    setLocalTime(offsetLocalTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragOffset]);

  /*
   * redraw the trains if
   * - the simulation trains or the selected train have changed
   * - the chart is rotated or centered (reset)
   * - the window or the chart have been resized (heightOfSpaceTimeChart)
   */
  useEffect(() => {
    if (trainSimulations) {
      const trainsToDraw = createTrain(KEY_VALUES_FOR_SPACE_TIME_CHART, trainSimulations);
      drawAllTrains(
        allowancesSettings,
        chart,
        CHART_ID,
        dispatchUpdateChart,
        dispatchUpdateDepartureArrivalTimes,
        dispatchUpdateMustRedraw,
        dispatchUpdateSelectedTrain,
        heightOfSpaceTimeChart,
        KEY_VALUES_FOR_SPACE_TIME_CHART,
        ref,
        resetChart,
        rotate,
        selectedProjection,
        selectedTrain,
        setChart,
        setDragOffset,
        setSelectedTrain,
        trainSimulations,
        simulationIsPlaying,
        trainsToDraw
      );
      setResetChart(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetChart, rotate, selectedTrain, trainSimulations, heightOfSpaceTimeChart]);

  /**
   * add behaviour on zoom and mousemove/mouseover/wheel on the new chart each time the chart changes
   */
  useEffect(() => {
    if (trainSimulations) {
      const dataSimulation = createTrain(KEY_VALUES_FOR_SPACE_TIME_CHART, trainSimulations)[
        selectedTrain
      ];
      isolatedEnableInteractivity(
        chart,
        dataSimulation,
        KEY_VALUES_FOR_SPACE_TIME_CHART,
        LIST_VALUES_NAME_SPACE_TIME,
        rotate,
        setChart,
        setLocalTime,
        setLocalPosition,
        setMousePos,
        simulationIsPlaying,
        dispatchUpdateMustRedraw,
        dispatchUpdateTimePositionValues
      );
      const immediatePositionsValuesForPointer = interpolateOnTime(
        dataSimulation,
        KEY_VALUES_FOR_SPACE_TIME_CHART,
        LIST_VALUES_NAME_SPACE_TIME,
        localTime
      );
      displayGuide(chart, 1);
      updatePointers(
        chart,
        KEY_VALUES_FOR_SPACE_TIME_CHART,
        LIST_VALUES_NAME_SPACE_TIME,
        immediatePositionsValuesForPointer,
        rotate
      );
      moveGridLinesOnMouseMove();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart]);

  useEffect(() => {
    moveGridLinesOnMouseMove();
  }, [mousePos]);

  const handleKey = ({ key }) => {
    if (['+', '-'].includes(key)) {
      setShowModal(key);
    }
  };

  const debounceResize = () => {
    const height = d3.select(`#container-${CHART_ID}`).node().clientHeight;
    setHeightOfSpaceTimeChart(height);
  };

  /**
   * add behaviour: Type " + " or " - " to update departure time by second
   */
  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    window.addEventListener('resize', debounceResize);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', debounceResize);
    };
  }, []);

  return (
    <Rnd
      ref={rndContainerRef}
      default={{
        x: 0,
        y: 0,
        width: '100%',
        height: `${heightOfSpaceTimeChart}px`,
      }}
      minHeight={CHART_MIN_HEIGHT}
      disableDragging
      enableResizing={{
        bottom: true,
      }}
      onResizeStart={() => {
        setBaseHeightOfSpaceTimeChart(heightOfSpaceTimeChart);
        onSetBaseHeightOfSpaceTimeChart(heightOfSpaceTimeChart);
      }}
      onResize={(_e, _dir, _refToElement, delta) => {
        setHeightOfSpaceTimeChart(baseHeightOfSpaceTimeChart + delta.height);
        onSetBaseHeightOfSpaceTimeChart(baseHeightOfSpaceTimeChart + delta.height);
      }}
    >
      <div
        id={`container-${CHART_ID}`}
        className="spacetime-chart w-100"
        style={{ height: `100%` }}
      >
        {showModal !== '' ? (
          <ChartModal
            type={showModal}
            setShowModal={setShowModal}
            trainName={trainSimulations?.[selectedTrain]?.name}
            offsetTimeByDragging={dragShiftTrain}
          />
        ) : null}
        <div style={{ height: `100%` }} ref={ref} />
        <button
          type="button"
          className="btn-rounded btn-rounded-white box-shadow btn-rotate"
          onClick={() => toggleRotation()}
        >
          <i className="icons-refresh" />
        </button>
        <button
          type="button"
          className="btn-rounded btn-rounded-white box-shadow btn-rotate mr-5"
          onClick={() => {
            setRotate(false);
            setResetChart(true);
          }}
        >
          <GiResize />
        </button>
        <div className="handle-tab-resize">
          <CgLoadbar />
        </div>
      </div>
    </Rnd>
  );
}

SpaceTimeChart.propTypes = {
  allowancesSettings: PropTypes.any,
  dispatchUpdateChart: PropTypes.any,
  dispatchUpdateDepartureArrivalTimes: PropTypes.func,
  dispatchUpdateMustRedraw: PropTypes.func,
  dispatchUpdateSelectedTrain: PropTypes.func,
  dispatchUpdateTimePositionValues: PropTypes.any,
  initialHeightOfSpaceTimeChart: PropTypes.any,
  inputSelectedTrain: PropTypes.any,
  positionValues: PropTypes.any,
  selectedProjection: PropTypes.any.isRequired,
  simulation: PropTypes.any,
  simulationIsPlaying: PropTypes.bool,
  timePosition: PropTypes.any,
  onOffsetTimeByDragging: PropTypes.func,
  onSetBaseHeightOfSpaceTimeChart: PropTypes.any,
};

SpaceTimeChart.defaultProps = {
  allowancesSettings: ORSD_GRAPH_SAMPLE_DATA.allowancesSettings,
  dispatchUpdateChart: noop,
  dispatchUpdateDepartureArrivalTimes: noop,
  dispatchUpdateMustRedraw: noop,
  dispatchUpdateSelectedTrain: noop,
  dispatchUpdateTimePositionValues: noop,
  inputSelectedTrain: ORSD_GRAPH_SAMPLE_DATA.selectedTrain,
  initialHeightOfSpaceTimeChart: 400,
  onOffsetTimeByDragging: noop,
  onSetBaseHeightOfSpaceTimeChart: noop,
  positionValues: ORSD_GRAPH_SAMPLE_DATA.positionValues,
  simulation: ORSD_GRAPH_SAMPLE_DATA.simulation.present,
  simulationIsPlaying: false,
  timePosition: ORSD_GRAPH_SAMPLE_DATA.timePosition,
};
