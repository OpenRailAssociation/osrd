import { noop } from 'lodash';
import * as d3 from 'd3';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CgLoadbar } from 'react-icons/cg';
import { GiResize } from 'react-icons/gi';
import PropTypes from 'prop-types';
import { Rnd } from 'react-rnd';
import ORSD_GRAPH_SAMPLE_DATA from 'applications/operationalStudies/components/SimulationResults/SpeedSpaceChart/sampleData';
import {
  isolatedEnableInteractivity,
  traceVerticalLine,
} from 'applications/operationalStudies/components/SimulationResults/ChartHelpers/enableInteractivity';
import {
  LIST_VALUES_NAME_SPEED_SPACE,
  SPEED_SPACE_CHART_KEY_VALUES,
} from 'applications/operationalStudies/components/SimulationResults/simulationResultsConsts';
import SpeedSpaceSettings from 'applications/operationalStudies/components/SimulationResults/SpeedSpaceSettings/SpeedSpaceSettings';
import {
  createChart,
  drawTrain,
} from 'applications/operationalStudies/components/SimulationResults/SpeedSpaceChart/d3Helpers';
import ElectricalProfilesLegend from './ElectricalProfilesLegend';
import prepareData from './prepareData';

const CHART_ID = 'SpeedSpaceChart';
const CHART_MIN_HEIGHT = 250;
/**
 * A chart to see the evolution of speed of one train on its journey
 * Features:
 * - One train only (current selected)
 * - Vertical line to the current position
 * - 2 marchs displayed: base and alternative
 *
 */
export default function SpeedSpaceChart(props) {
  const {
    chartXGEV,
    dispatchUpdateMustRedraw,
    dispatchUpdateTimePositionValues,
    initialHeightOfSpeedSpaceChart,
    mustRedraw,
    positionValues,
    trainSimulation,
    simulationIsPlaying,
    speedSpaceSettings,
    onSetSettings,
    onSetBaseHeightOfSpeedSpaceChart,
    timePosition,
  } = props;

  const [baseHeightOfSpeedSpaceChart, setBaseHeightOfSpeedSpaceChart] = useState(
    initialHeightOfSpeedSpaceChart
  );
  const [chart, setChart] = useState(undefined);
  const [isActive, setIsActive] = useState(false);
  const [heightOfSpeedSpaceChart, setHeightOfSpeedSpaceChart] = useState(
    initialHeightOfSpeedSpaceChart
  );
  const [localSettings, setLocalSettings] = useState(speedSpaceSettings);
  const [resetChart, setResetChart] = useState(false);
  const [rotate, setRotate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const ref = useRef();

  const onLocalSetSettings = (settings) => {
    setLocalSettings(settings);
    onSetSettings(settings);
  };

  // draw the train
  const createChartAndTrain = useCallback(() => {
    const localChart = createChart(
      CHART_ID,
      chart,
      resetChart,
      trainSimulation,
      rotate,
      heightOfSpeedSpaceChart,
      ref,
      setResetChart
    );
    setChart(localChart);
    drawTrain(trainSimulation, rotate, localSettings, localChart);
  }, [chart, trainSimulation, heightOfSpeedSpaceChart, localSettings, resetChart, rotate]);

  // rotation Handle (button on right bottom)
  const toggleRotation = () => {
    // TODO: this should be moved in createChart
    d3.select(`#${CHART_ID}`).remove();
    setChart({
      ...chart,
      x: chart.y,
      y: chart.x,
      originalScaleX: chart.originalScaleY,
      originalScaleY: chart.originalScaleX,
    });
    setRotate(!rotate);
  };

  const debounceResize = (interval) => {
    let debounceTimeoutId;
    clearTimeout(debounceTimeoutId);
    debounceTimeoutId = setTimeout(() => {
      const height = d3.select(`#container-${CHART_ID}`).node().clientHeight;
      setHeightOfSpeedSpaceChart(height);
    }, interval);
  };

  // in case of initial ref creation of rotate, recreate the chart
  useEffect(() => {
    setChart(
      createChart(
        CHART_ID,
        chart,
        resetChart,
        trainSimulation,
        rotate,
        heightOfSpeedSpaceChart,
        ref,
        setResetChart
      )
    );
  }, [ref, rotate, heightOfSpeedSpaceChart]);

  // plug event handlers once the chart is ready or recreated
  useEffect(() => {
    isolatedEnableInteractivity(
      chart,
      trainSimulation,
      SPEED_SPACE_CHART_KEY_VALUES,
      LIST_VALUES_NAME_SPEED_SPACE,
      rotate,
      setChart,
      noop,
      noop,
      noop,
      simulationIsPlaying,
      dispatchUpdateMustRedraw,
      dispatchUpdateTimePositionValues
    );
  }, [chart]);

  // redraw the train if necessary
  useEffect(() => {
    createChartAndTrain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mustRedraw, rotate, localSettings]);

  // draw or redraw the position line indictator when usefull
  useEffect(() => {
    traceVerticalLine(
      chart,
      trainSimulation,
      SPEED_SPACE_CHART_KEY_VALUES,
      LIST_VALUES_NAME_SPEED_SPACE,
      positionValues,
      'speed',
      rotate,
      timePosition
    );
  }, [chart, mustRedraw, positionValues, timePosition]);

  useEffect(() => {
    if (chartXGEV) {
      setChart({ ...chart, x: chartXGEV });
    }
  }, [chartXGEV]);

  // set the window resize event manager
  useEffect(() => {
    window.addEventListener('resize', debounceResize);
    return () => {
      window.removeEventListener('resize', debounceResize);
    };
  }, []);

  // reset chart
  useEffect(() => {
    if (resetChart) {
      if (rotate) {
        // cancel rotation and redraw the train
        toggleRotation();
      } else {
        createChartAndTrain();
      }
    }
  }, [resetChart]);

  // draw the first chart
  useEffect(() => {
    createChartAndTrain();
  }, []);

  return (
    <Rnd
      default={{
        x: 0,
        y: 0,
        width: '100%',
        height: `${heightOfSpeedSpaceChart}px`,
      }}
      minHeight={CHART_MIN_HEIGHT}
      disableDragging
      enableResizing={{
        bottom: true,
      }}
      onResizeStart={() => {
        setBaseHeightOfSpeedSpaceChart(heightOfSpeedSpaceChart);
        onSetBaseHeightOfSpeedSpaceChart(heightOfSpeedSpaceChart);
      }}
      onResize={(_e, _dir, _refToElement, delta) => {
        setHeightOfSpeedSpaceChart(baseHeightOfSpeedSpaceChart + delta.height);
        onSetBaseHeightOfSpeedSpaceChart(baseHeightOfSpeedSpaceChart + delta.height);
      }}
      onResizeStop={() => {
        dispatchUpdateMustRedraw(true);
      }}
    >
      <div
        id={`container-${CHART_ID}`}
        className="speedspace-chart w-100"
        style={{ height: `${heightOfSpeedSpaceChart}px` }}
      >
        <button
          type="button"
          className="showSettingsButton"
          onClick={() => setShowSettings(!showSettings)}
        >
          <i className={showSettings ? 'icons-arrow-prev' : 'icons-arrow-next'} />
        </button>
        <SpeedSpaceSettings
          showSettings={showSettings}
          onSetSettings={onLocalSetSettings}
          speedSpaceSettings={speedSpaceSettings}
        />
        <div ref={ref} className="w-100" />
        {localSettings.electricalProfiles && (
          <button
            type="button"
            className="btn-rounded btn-rounded-white box-shadow btn-rotate mt-5"
            onClick={() => {
              setIsActive(!isActive);
            }}
          >
            <i className="icons-circle-information" />
          </button>
        )}
        <button
          type="button"
          className="btn-rounded btn-rounded-white box-shadow btn-rotate mr-5"
          onClick={() => setResetChart(true)}
        >
          <GiResize />
        </button>
        <button
          type="button"
          className="btn-rounded btn-rounded-white box-shadow btn-rotate"
          onClick={() => toggleRotation(rotate, setRotate)}
        >
          <i className="icons-refresh" />
        </button>
        <div className="handle-tab-resize">
          <CgLoadbar />
        </div>
      </div>
      {isActive ? <ElectricalProfilesLegend isActive={isActive} setIsActive={setIsActive} /> : null}
    </Rnd>
  );
}

SpeedSpaceChart.propTypes = {
  /**
   * Current X linear scale for synced charts
   */
  chartXGEV: PropTypes.func,
  dispatchUpdateMustRedraw: PropTypes.func,
  dispatchUpdateTimePositionValues: PropTypes.func,
  /**
   * height of chart
   */
  initialHeightOfSpeedSpaceChart: PropTypes.number.isRequired,
  /**
   * Force d3 render trigger ! To be removed
   */
  mustRedraw: PropTypes.bool,
  /**
   * Current Position to be showed (vertical line)
   */
  positionValues: PropTypes.object,
  /**
   * current simulation (selected train)
   */
  trainSimulation: PropTypes.object,
  simulationIsPlaying: PropTypes.bool,
  /**
   * Chart settings
   */
  speedSpaceSettings: PropTypes.object,
  onSetSettings: PropTypes.func,
  onSetBaseHeightOfSpeedSpaceChart: PropTypes.func,
  /**
   * Current Time Position to be showed (vertical line)
   */
  timePosition: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
};

SpeedSpaceChart.defaultProps = {
  chartXGEV: undefined,
  dispatchUpdateMustRedraw: noop,
  dispatchUpdateTimePositionValues: noop,
  mustRedraw: false,
  onSetBaseHeightOfSpeedSpaceChart: noop,
  onSetSettings: noop,
  positionValues: ORSD_GRAPH_SAMPLE_DATA.positionValues,
  simulationIsPlaying: false,
  speedSpaceSettings: ORSD_GRAPH_SAMPLE_DATA.speedSpaceSettings,
  timePosition: ORSD_GRAPH_SAMPLE_DATA.timePosition,
  trainSimulation: prepareData(
    ORSD_GRAPH_SAMPLE_DATA.simulation.present,
    ORSD_GRAPH_SAMPLE_DATA.selectedTrain
  ),
};
