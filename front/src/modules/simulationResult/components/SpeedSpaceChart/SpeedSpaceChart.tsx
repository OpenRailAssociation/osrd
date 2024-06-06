import React, { useEffect, useMemo, useRef, useState } from 'react';

import { ChevronLeft, ChevronRight, Info } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { CgLoadbar } from 'react-icons/cg';
import { GiResize } from 'react-icons/gi';
import { useSelector } from 'react-redux';
import { Rnd } from 'react-rnd';

import type { LightRollingStock, SimulationReport } from 'common/api/osrdEditoastApi';
import { interpolateOnPosition } from 'modules/simulationResult/components/ChartHelpers/ChartHelpers';
import {
  enableInteractivity,
  traceVerticalLine,
} from 'modules/simulationResult/components/ChartHelpers/enableInteractivity';
import { useChartSynchronizer } from 'modules/simulationResult/components/ChartSynchronizer';
import {
  createSpeedSpaceChart,
  drawTrain,
} from 'modules/simulationResult/components/SpeedSpaceChart/d3Helpers';
import { CHART_AXES, type ChartAxes } from 'modules/simulationResult/consts';
import type { PositionScaleDomain } from 'modules/simulationResult/types';
import { updateSpeedSpaceSettings } from 'reducers/osrdsimulation/actions';
import { getIsPlaying, getSpeedSpaceSettings } from 'reducers/osrdsimulation/selectors';
import type { SpeedSpaceChart, SpeedSpaceSettingsType, Train } from 'reducers/osrdsimulation/types';
import { useAppDispatch } from 'store';
import { dateIsInRange } from 'utils/date';

import ElectricalProfilesLegend from './ElectricalProfilesLegend';
import prepareData from './prepareData';
import SpeedSpaceSettings from './SpeedSpaceSettings';

const CHART_ID = 'SpeedSpaceChart';
const CHART_MIN_HEIGHT = 250;
const SETTINGS_TO_AXIS = {
  altitude: CHART_AXES.SPACE_HEIGHT,
  curves: CHART_AXES.SPACE_RADIUS,
  slopes: CHART_AXES.SPACE_GRADIENT,
};

export type SpeedSpaceChartProps = {
  initialHeight: number;
  onSetChartBaseHeight: (chartBaseHeight: number) => void;
  selectedTrain: SimulationReport | Train;
  trainRollingStock?: LightRollingStock;
  sharedXScaleDomain?: PositionScaleDomain;
  setSharedXScaleDomain?: React.Dispatch<React.SetStateAction<PositionScaleDomain>>;
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
  trainRollingStock,
  sharedXScaleDomain,
  setSharedXScaleDomain,
}: SpeedSpaceChartProps) {
  const simulationIsPlaying = useSelector(getIsPlaying);
  const speedSpaceSettings = useSelector(getSpeedSpaceSettings);

  const [chart, setChart] = useState<SpeedSpaceChart | undefined>(undefined);
  const [chartBaseHeight, setChartBaseHeight] = useState(initialHeight);
  const [chartHeight, setChartHeight] = useState(initialHeight);
  const [isActive, setIsActive] = useState(false);
  const [localSettings, setLocalSettings] = useState(speedSpaceSettings);
  const [resetChart, setResetChart] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const ref = useRef<HTMLDivElement>(null);

  const dispatch = useAppDispatch();
  const { t } = useTranslation('simulation');

  const toggleSetting = (settings: SpeedSpaceSettingsType) => {
    dispatch(updateSpeedSpaceSettings(settings));
  };

  const onLocalSetSettings = (settings: SpeedSpaceSettingsType) => {
    setLocalSettings(settings);
    toggleSetting(settings);
  };

  const trainSimulation = useMemo(() => prepareData(selectedTrain as Train), [selectedTrain]);

  const timeScaleRange: [Date, Date] = useMemo(() => {
    if (chart) {
      const spaceScaleRange = chart.x.domain();
      return spaceScaleRange.map((position) =>
        interpolateOnPosition(trainSimulation, position)
      ) as [Date, Date];
    }
    return [new Date(), new Date()];
  }, [chart]);

  /**
   * coordinate guidelines and pointers with other graphs
   *
   * when timePosition or positionValues are updated by moving the mouse on an other graph,
   * the guidelines and pointers are updated on the SpeedSpaceChart too
   */
  const { updateTimePosition } = useChartSynchronizer(
    (newTimePosition, positionValues) => {
      if (dateIsInRange(newTimePosition, timeScaleRange)) {
        traceVerticalLine(chart, CHART_AXES.SPACE_SPEED, positionValues, newTimePosition);
      }
    },
    'speed-space-chart',
    [chart, timeScaleRange]
  );

  /**
   * DRAW AND REDRAW TRAIN
   */

  const createChartAndTrain = () => {
    const localChart = createSpeedSpaceChart(
      CHART_ID,
      resetChart,
      trainSimulation,
      initialHeight,
      ref,
      chart
    ) as SpeedSpaceChart;

    setChart(localChart);
    drawTrain(trainSimulation, localSettings, localChart);
    setResetChart(false);
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
   * - the local settings have been changed
   * - the chart has been resized (vertically only)
   */
  useEffect(() => {
    createChartAndTrain();
  }, [localSettings, chartHeight]);

  useEffect(() => {
    if (chart && sharedXScaleDomain && sharedXScaleDomain.source !== CHART_ID) {
      const newChart = { ...chart };
      newChart.x.domain(sharedXScaleDomain.current);
      setChart(newChart);
      createChartAndTrain();
    }
  }, [sharedXScaleDomain]);

  /**
   * reset chart (only if resetChart is true)
   */
  useEffect(() => {
    if (resetChart) {
      if (chart && setSharedXScaleDomain) {
        setSharedXScaleDomain((prevState) => ({
          ...prevState,
          current: prevState.initial,
          source: undefined,
        }));
      } else {
        createChartAndTrain();
      }
    }
  }, [resetChart]);

  /**
   * Recompute the enabled axes when the settings change
   */
  const additionalAxes = useMemo(
    () =>
      Object.keys(SETTINGS_TO_AXIS)
        .filter((key) => localSettings[key as keyof typeof localSettings])
        .map((key) => SETTINGS_TO_AXIS[key as keyof typeof SETTINGS_TO_AXIS] as ChartAxes),
    [localSettings]
  );

  /**
   * CHART INTERACTIVITY
   */

  /**
   * plug event handlers once the chart is ready or recreated
   * - allow zooming (ctrl + third mouse button)
   * - on mouse move: update pointers and vertical/horizontal guidelines
   */
  useEffect(() => {
    enableInteractivity(
      chart,
      trainSimulation,
      CHART_AXES.SPACE_SPEED,
      false,
      setChart,
      simulationIsPlaying,
      updateTimePosition,
      timeScaleRange,
      setSharedXScaleDomain,
      additionalAxes
    );
  }, [chart, additionalAxes]);

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
  }, [chart, trainSimulation, localSettings, resetChart]);

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
        className="speedspace-chart chart"
        style={{ height: `${chartHeight}px` }}
      >
        <button
          type="button"
          className="showSettingsButton"
          aria-label={t('toggleSpeedSpaceSettings')}
          title={t('toggleSpeedSpaceSettings')}
          onClick={() => setShowSettings(!showSettings)}
        >
          {showSettings ? <ChevronLeft /> : <ChevronRight />}
        </button>
        <div>
          <SpeedSpaceSettings
            electrificationRanges={trainSimulation.electrificationRanges}
            showSettings={showSettings}
            onSetSettings={onLocalSetSettings}
            speedSpaceSettings={speedSpaceSettings}
            trainRollingStock={trainRollingStock}
          />
        </div>
        <div ref={ref} className="w-100" />
        {localSettings.electricalProfiles && (
          <button
            type="button"
            className="btn-rounded btn-rounded-white box-shadow btn-rotate mt-5"
            aria-label={t('toggleElectricalProfileLegend')}
            title={t('toggleElectricalProfileLegend')}
            onClick={() => {
              setIsActive(!isActive);
            }}
          >
            <Info />
          </button>
        )}
        <button
          type="button"
          className="btn-rounded btn-rounded-white box-shadow btn-rotate"
          aria-label={t('reset')}
          title={t('reset')}
          onClick={() => setResetChart(true)}
        >
          <GiResize />
        </button>
        <div className="handle-tab-resize">
          <CgLoadbar />
        </div>
        {isActive && <ElectricalProfilesLegend isActive={isActive} setIsActive={setIsActive} />}
      </div>
    </Rnd>
  );
}
