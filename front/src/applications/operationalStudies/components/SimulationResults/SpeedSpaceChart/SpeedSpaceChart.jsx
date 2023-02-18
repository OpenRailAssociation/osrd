import * as d3 from 'd3';
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { CgLoadbar } from 'react-icons/cg';
import { GiResize } from 'react-icons/gi';
import PropTypes from 'prop-types';
import { Rnd } from 'react-rnd';
import ORSD_GEV_SAMPLE_DATA from 'applications/operationalStudies/components/SimulationResults/SpeedSpaceChart/sampleData';
import enableInteractivity, {
  traceVerticalLine,
} from 'applications/operationalStudies/components/SimulationResults/ChartHelpers/enableInteractivity';
import { LIST_VALUES_NAME_SPEED_SPACE } from 'applications/operationalStudies/components/SimulationResults/simulationResultsConsts';
import prepareData from 'applications/operationalStudies/components/SimulationResults/SpeedSpaceChart/prepareData';
import SpeedSpaceSettings from 'applications/operationalStudies/components/SimulationResults/SpeedSpaceSettings/SpeedSpaceSettings';
import {
  createChart,
  drawTrain,
} from 'applications/operationalStudies/components/SimulationResults/SpeedSpaceChart/d3Helpers';
import { ElectricalProfilesLegend } from './ElectricalProfilesLegend';

const CHART_ID = 'SpeedSpaceChart';
const CHART_MIN_HEIGHT = 250;
/**
 * A chart to see the evolution of speed of one train on its journey
 * Features:
 * - One train only (current selected)
 * - Vertical line to the current position
 * - 2 marchs displayed: base and alternative
 *
 */ export default function SpeedSpaceChart(props) {
  const {
    simulation,
    chartXGEV,
    dispatch,
    mustRedraw,
    positionValues,
    selectedTrain,
    speedSpaceSettings,
    timePosition,
    consolidatedSimulation,
    initialHeightOfSpeedSpaceChart,
    onSetSettings,
    onSetBaseHeightOfSpeedSpaceChart,
    dispatchUpdateMustRedraw,
  } = props;

  const [showSettings, setShowSettings] = useState(false);
  const [rotate, setRotate] = useState(false);
  const [resetChart, setResetChart] = useState(false);
  const [chart, setChart] = useState(undefined);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [yPosition, setYPosition] = useState(0);
  const [localSettings, setLocalSettings] = useState(speedSpaceSettings);
  const [isActive, setIsActive] = useState(false);

  const [heightOfSpeedSpaceChart, setHeightOfSpeedSpaceChart] = useState(
    initialHeightOfSpeedSpaceChart
  );

  const [baseHeightOfSpeedSpaceChart, setBaseHeightOfSpeedSpaceChart] =
    useState(heightOfSpeedSpaceChart);

  const ref = useRef();
  const keyValues = ['position', 'speed'];

  const onLocalSetSettings = (settings) => {
    setLocalSettings(settings);
    onSetSettings(settings);
  };

  // Prepare data
  const dataSimulation = useMemo(
    () => prepareData(simulation, selectedTrain, keyValues),
    [simulation, selectedTrain, keyValues]
  );

  // draw the train
  const createChartAndTrain = useCallback(() => {
    const localChart = createChart(
      CHART_ID,
      chart,
      resetChart,
      dataSimulation,
      rotate,
      keyValues,
      heightOfSpeedSpaceChart,
      ref,
      dispatch,
      setResetChart
    );
    setChart(localChart);
    drawTrain(
      LIST_VALUES_NAME_SPEED_SPACE,
      simulation,
      selectedTrain,
      dataSimulation,
      keyValues,
      positionValues,
      rotate,
      localSettings,
      mustRedraw,
      setChart,
      setYPosition,
      setZoomLevel,
      yPosition,
      dispatch,
      zoomLevel,
      CHART_ID,
      localChart,
      resetChart,
      heightOfSpeedSpaceChart,
      ref,
      setResetChart,
      true
    );
  }, [
    chart,
    dataSimulation,
    dispatch,
    heightOfSpeedSpaceChart,
    keyValues,
    localSettings,
    mustRedraw,
    positionValues,
    resetChart,
    rotate,
    selectedTrain,
    simulation,
    yPosition,
    zoomLevel,
  ]);

  // rotation Handle (button on right bottom)
  const toggleRotation = () => {
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

  // Reset Chart Handle (first button on right bottom)
  const resetChartToggle = () => {
    d3.select(`#${CHART_ID}`).remove();
    setRotate(false);
    setChart(
      createChart(
        CHART_ID,
        chart,
        resetChart,
        dataSimulation,
        false,
        keyValues,
        heightOfSpeedSpaceChart,
        ref,
        dispatch,
        setResetChart
      )
    );
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
        dataSimulation,
        rotate,
        keyValues,
        heightOfSpeedSpaceChart,
        ref,
        dispatch,
        setResetChart
      )
    );
  }, [ref, rotate, heightOfSpeedSpaceChart]);

  // plug event handlers once the chart is ready or recreated
  useEffect(() => {
    enableInteractivity(
      chart,
      dataSimulation,
      dispatch,
      keyValues,
      LIST_VALUES_NAME_SPEED_SPACE,
      positionValues,
      rotate,
      setChart,
      setYPosition,
      setZoomLevel,
      yPosition,
      zoomLevel
    );
  }, [chart]);

  // redraw the train if necessary
  useEffect(() => {
    createChartAndTrain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mustRedraw, rotate, consolidatedSimulation, localSettings]);

  // draw or redraw the position line indictator when usefull
  useEffect(() => {
    traceVerticalLine(
      chart,
      dataSimulation,
      keyValues,
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
  useEffect(() => resetChartToggle(), [resetChart]);

  // draw the first chart
  useEffect(() => {
    createChartAndTrain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  dispatchUpdateMustRedraw: PropTypes.func,
  /**
   * height of chart
   */
  heightOfSpeedSpaceChart: PropTypes.number,
  /**
   * current simulation (selected train) ! to be removed
   */
  simulation: PropTypes.object,
  /**
   * Current X linear scale for synced charts
   */
  chartXGEV: PropTypes.func,
  /**
   * Dispath to store func
   */
  dispatch: PropTypes.func,
  /**
   * Force d3 render trigger ! To be removed
   */
  mustRedraw: PropTypes.bool,
  /**
   * Current Position to be showed (vertical line)
   */
  positionValues: PropTypes.object,
  /**
   * Current Selected Train index
   */
  selectedTrain: PropTypes.number,
  /**
   * Chart settings
   */
  speedSpaceSettings: PropTypes.object,
  /**
   * Current Time Position to be showed (vertical line)
   */
  timePosition: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
  /**
   * Current Simulation with more data (for current train)
   */
  consolidatedSimulation: PropTypes.array,
  /**
   * Toggle the Settings div ! Not isolated
   */
  toggleSetting: PropTypes.func,
};

SpeedSpaceChart.defaultProps = {
  heightOfSpeedSpaceChart: 250,
  simulation: ORSD_GEV_SAMPLE_DATA.simulation.present,
  chartXGEV: undefined,
  dispatch: () => {},
  mustRedraw: ORSD_GEV_SAMPLE_DATA.mustRedraw,
  positionValues: ORSD_GEV_SAMPLE_DATA.positionValues,
  selectedTrain: ORSD_GEV_SAMPLE_DATA.selectedTrain,
  speedSpaceSettings: ORSD_GEV_SAMPLE_DATA.speedSpaceSettings,
  timePosition: ORSD_GEV_SAMPLE_DATA.timePosition,
  consolidatedSimulation: ORSD_GEV_SAMPLE_DATA.consolidatedSimulation,
  toggleSetting: () => {},
  onSetSettings: () => {},
  dispatchUpdateMustRedraw: () => {},
  onSetBaseHeightOfSpeedSpaceChart: ({ ...args }) => {},
};
