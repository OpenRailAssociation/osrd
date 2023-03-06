import * as d3 from 'd3';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  isolatedEnableInteractivity,
  traceVerticalLine,
} from 'applications/operationalStudies/components/SimulationResults/ChartHelpers/enableInteractivity';
import { Rnd } from 'react-rnd';
import { timeShiftTrain } from 'applications/operationalStudies/components/SimulationResults/ChartHelpers/ChartHelpers';
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
  const [showModal, setShowModal] = useState('');
  const [trainSimulations, setTrainSimulations] = useState(undefined);

  const dragShiftTrain = useCallback(
    (offset) => {
      if (trainSimulations) {
        const trains = trainSimulations.map((train, ind) =>
          ind === selectedTrain ? timeShiftTrain(train, offset) : train
        );
        setTrainSimulations(trains);
        onOffsetTimeByDragging(trains);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trainSimulations, selectedTrain, onOffsetTimeByDragging]
  );

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
   */
  useEffect(() => {
    dragShiftTrain(dragOffset);
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
      isolatedEnableInteractivity(
        chart,
        createTrain(KEY_VALUES_FOR_SPACE_TIME_CHART, trainSimulations)[selectedTrain],
        KEY_VALUES_FOR_SPACE_TIME_CHART,
        LIST_VALUES_NAME_SPACE_TIME,
        rotate,
        setChart,
        simulationIsPlaying,
        dispatchUpdateMustRedraw,
        dispatchUpdateTimePositionValues
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart]);

  /**
   * coordinates the vertical cursors with other graphs (GEV for instance)
   */
  useEffect(() => {
    if (trainSimulations) {
      traceVerticalLine(
        chart,
        trainSimulations?.[selectedTrain],
        KEY_VALUES_FOR_SPACE_TIME_CHART,
        LIST_VALUES_NAME_SPACE_TIME,
        positionValues,
        'headPosition',
        rotate,
        timePosition
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart, positionValues, timePosition]);

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
  dispatchUpdateChart: () => {},
  dispatchUpdateDepartureArrivalTimes: () => {},
  dispatchUpdateMustRedraw: () => {},
  dispatchUpdateSelectedTrain: () => {},
  dispatchUpdateTimePositionValues: () => {},
  inputSelectedTrain: ORSD_GRAPH_SAMPLE_DATA.selectedTrain,
  initialHeightOfSpaceTimeChart: 400,
  onOffsetTimeByDragging: () => {},
  onSetBaseHeightOfSpaceTimeChart: () => {},
  positionValues: ORSD_GRAPH_SAMPLE_DATA.positionValues,
  simulation: ORSD_GRAPH_SAMPLE_DATA.simulation.present,
  simulationIsPlaying: false,
  timePosition: ORSD_GRAPH_SAMPLE_DATA.timePosition,
};
