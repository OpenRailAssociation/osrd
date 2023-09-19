import { noop } from 'lodash';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CgLoadbar } from 'react-icons/cg';
import { GiResize } from 'react-icons/gi';
import { Rnd } from 'react-rnd';
import {
  isolatedEnableInteractivity,
  traceVerticalLine,
} from 'applications/operationalStudies/components/SimulationResults/ChartHelpers/enableInteractivity';
import {
  LIST_VALUES_NAME_SPEED_SPACE,
  SPEED_SPACE_CHART_KEY_VALUES,
} from 'applications/operationalStudies/components/SimulationResults/simulationResultsConsts';
import {
  createChart,
  drawTrain,
} from 'applications/operationalStudies/components/SimulationResults/SpeedSpaceChart/d3Helpers';
import { SpeedSpaceChart, SpeedSpaceSettingsType, Train } from 'reducers/osrdsimulation/types';
import { useDispatch, useSelector } from 'react-redux';
import {
  getIsPlaying,
  getPositionValues,
  getSpeedSpaceSettings,
  getTimePosition,
} from 'reducers/osrdsimulation/selectors';
import {
  updateSpeedSpaceSettings,
  updateTimePositionValues,
} from 'reducers/osrdsimulation/actions';
import { SimulationReport } from 'common/api/osrdEditoastApi';
import ElectricalProfilesLegend from './ElectricalProfilesLegend';
import prepareData from './prepareData';
import SpeedSpaceSettings from './SpeedSpaceSettings';

const CHART_ID = 'SpeedSpaceChart';
const CHART_MIN_HEIGHT = 250;

export type SpeedSpaceChartProps = {
  initialHeight: number;
  onSetChartBaseHeight: (chartBaseHeight: number) => void;
  selectedTrain: SimulationReport | Train;
};

/**
 * A chart to see the evolution of speed of one train on its journey
 *
 * Features:
 * - One train only (current selected)
 * - Vertical line to the current position
 * - 2 marchs displayed: base and alternative
 *
 */
export default function SpeedSpaceChart({
  initialHeight,
  onSetChartBaseHeight,
  selectedTrain,
}: SpeedSpaceChartProps) {
  const timePosition = useSelector(getTimePosition);
  const positionValues = useSelector(getPositionValues);
  const simulationIsPlaying = useSelector(getIsPlaying);
  const speedSpaceSettings = useSelector(getSpeedSpaceSettings);

  const [chart, setChart] = useState<SpeedSpaceChart | undefined>(undefined);
  const [chartBaseHeight, setChartBaseHeight] = useState(initialHeight);
  const [chartHeight, setChartHeight] = useState(initialHeight);
  const [hasJustRotated, setHasJustRotated] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [localSettings, setLocalSettings] = useState(speedSpaceSettings);
  const [resetChart, setResetChart] = useState(false);
  const [rotate, setRotate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const ref = useRef<HTMLDivElement>(null);

  const dispatch = useDispatch();

  const dispatchUpdateTimePositionValues = (newTimePositionValues: string) => {
    dispatch(updateTimePositionValues(newTimePositionValues));
  };

  const toggleSetting = (settings: SpeedSpaceSettingsType) => {
    dispatch(updateSpeedSpaceSettings(settings));
  };

  const onLocalSetSettings = (settings: SpeedSpaceSettingsType) => {
    setLocalSettings(settings);
    toggleSetting(settings);
  };

  const trainSimulation = useMemo(() => prepareData(selectedTrain), [selectedTrain]);

  /**
   * DRAW AND REDRAW TRAIN
   */

  const createChartAndTrain = () => {
    const localChart = createChart(
      CHART_ID,
      resetChart,
      trainSimulation,
      hasJustRotated,
      initialHeight,
      ref,
      chart
    ) as SpeedSpaceChart;
    setChart(localChart);
    drawTrain(trainSimulation, rotate, localSettings, localChart);
    setHasJustRotated(false);
    setResetChart(false);
  };

  const toggleRotation = () => {
    setRotate(!rotate);
    setHasJustRotated(true);
  };

  /**
   * draw the first chart
   */
  useEffect(() => {
    createChartAndTrain();
  }, []);

  /**
   * reset the chart if the trainSimulation has changed
   */
  useEffect(() => {
    setResetChart(true);
  }, [trainSimulation]);

  /**
   * redraw the train if:
   * - the train must be rotated
   * - the local settings have been changed
   * - the chart has been resized (vertically only)
   */
  useEffect(() => {
    createChartAndTrain();
  }, [rotate, localSettings, chartHeight]);

  /**
   * reset chart (only if resetChart is true)
   */
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

  /**
   * CHART INTERACTIVITY
   */

  /**
   * plug event handlers once the chart is ready or recreated
   * - allow zooming (ctrl + third mouse button)
   * - on mouse move: update pointers and vertical/horizontal guidelines
   */
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
      noop,
      dispatchUpdateTimePositionValues
    );
  }, [chart]);

  /**
   * coordinate guidelines and pointers with other graphs
   *
   * when timePosition or positionValues are updated by moving the mouse on an other graph,
   * the guidelines and pointers are updated on the SpeedSpaceChart too
   */
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
  }, [chart, positionValues, timePosition]);

  /**
   * redraw the graph when resized horizontally (window resized)
   */
  useEffect(() => {
    const debounceResize = () => {
      let debounceTimeoutId;
      clearTimeout(debounceTimeoutId);
      debounceTimeoutId = setTimeout(() => {
        createChartAndTrain();
      }, 15);
    };
    window.addEventListener('resize', debounceResize);
    return () => {
      window.removeEventListener('resize', debounceResize);
    };
  }, [chart, trainSimulation, localSettings, resetChart, rotate]);

  return (
    <Rnd
      default={{
        x: 0,
        y: 0,
        width: '100%',
        height: `${chartHeight}px`,
      }}
      minHeight={CHART_MIN_HEIGHT}
      disableDragging
      enableResizing={{
        bottom: true,
      }}
      onResizeStart={() => {
        setChartBaseHeight(chartHeight);
        onSetChartBaseHeight(chartHeight);
      }}
      onResize={(_e, _dir, _refToElement, delta) => {
        setChartHeight(chartBaseHeight + delta.height);
        onSetChartBaseHeight(chartBaseHeight + delta.height);
      }}
    >
      <div
        id={`container-${CHART_ID}`}
        className="speedspace-chart w-100"
        style={{ height: `${chartHeight}px` }}
      >
        <button
          type="button"
          className="showSettingsButton"
          onClick={() => setShowSettings(!showSettings)}
        >
          <i className={showSettings ? 'icons-arrow-prev' : 'icons-arrow-next'} />
        </button>
        <div>
          <SpeedSpaceSettings
            electrificationRanges={trainSimulation.electrificationRanges}
            showSettings={showSettings}
            onSetSettings={onLocalSetSettings}
            speedSpaceSettings={speedSpaceSettings}
          />
        </div>
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
          onClick={() => toggleRotation()}
        >
          <i className="icons-refresh" />
        </button>
        <div className="handle-tab-resize">
          <CgLoadbar />
        </div>
        {isActive ? (
          <ElectricalProfilesLegend isActive={isActive} setIsActive={setIsActive} />
        ) : null}
      </div>
    </Rnd>
  );
}
