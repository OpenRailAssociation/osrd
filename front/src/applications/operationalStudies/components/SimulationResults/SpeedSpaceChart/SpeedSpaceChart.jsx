import { noop } from 'lodash';
import React, { useEffect, useRef, useState } from 'react';
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
import { useTranslation } from 'react-i18next';
import ElectricalProfilesLegend from './ElectricalProfilesLegend';
import prepareData from './prepareData';

const CHART_ID = 'SpeedSpaceChart';
const CHART_MIN_HEIGHT = 250;

/**
 * A chart to see the evolution of speed of one train on its journey
 *
 * Features:
 * - One train only (current selected)
 * - Vertical line to the current position
 * - 2 marchs displayed: base and alternative
 *
 */
export default function SpeedSpaceChart(props) {
  const {
    dispatchUpdateMustRedraw,
    dispatchUpdateTimePositionValues,
    initialHeight,
    positionValues,
    trainSimulation,
    simulationIsPlaying,
    speedSpaceSettings,
    onSetSettings,
    onSetChartBaseHeight,
    timePosition,
  } = props;

  // to be removed after creating power restriction module
  const { t } = useTranslation(['simulation']);

  const [chart, setChart] = useState(undefined);
  const [chartBaseHeight, setChartBaseHeight] = useState(initialHeight);
  const [chartHeight, setChartHeight] = useState(initialHeight);
  const [hasJustRotated, setHasJustRotated] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [localSettings, setLocalSettings] = useState(speedSpaceSettings);
  const [resetChart, setResetChart] = useState(false);
  const [restrictionPower, setRestrictionPower] = useState('');
  const [rotate, setRotate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const ref = useRef();

  const onLocalSetSettings = (settings) => {
    setLocalSettings(settings);
    onSetSettings(settings);
  };

  /**
   * DRAW AND REDRAW TRAIN
   */

  const createChartAndTrain = () => {
    const localChart = createChart(
      CHART_ID,
      chart,
      resetChart,
      trainSimulation,
      hasJustRotated,
      initialHeight,
      ref
    );
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
      dispatchUpdateMustRedraw,
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

  // to be removed after creating power restriction module
  useEffect(() => {
    let newRestrictionPower = '';
    trainSimulation.electrificationConditions.forEach((elem) => {
      if (elem.used_restriction)
        newRestrictionPower = `${t('speedSpaceSettings.powerRestriction')}: ${
          elem.used_restriction
        }`;
    });
    if (!newRestrictionPower) {
      trainSimulation.electrificationConditions.forEach((elem) => {
        if (elem.seen_restriction)
          newRestrictionPower = `${t('speedSpaceSettings.powerRestriction')} ${
            elem.seen_restriction
          } ${t('powerRestriction.waited')}, ${t('powerRestriction.incompatible')}`;
      });
    }
    setRestrictionPower(newRestrictionPower);
  }, [trainSimulation]);

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

        {/* to be removed after creating power restriction module */}
        {localSettings.powerRestriction && (
          <div className="fixed-top d-flex justify-content-center w-25 m-auto">
            <div
              className="mt-2"
              style={{
                backgroundColor: '#333',
                color: 'white',
                borderRadius: '0.3rem',
                padding: '0.2rem',
              }}
            >
              {restrictionPower || t('powerRestriction.unknown')}
            </div>
          </div>
        )}
      </div>
    </Rnd>
  );
}

SpeedSpaceChart.propTypes = {
  dispatchUpdateMustRedraw: PropTypes.func,
  dispatchUpdateTimePositionValues: PropTypes.func,
  /**
   * height of chart
   */
  initialHeight: PropTypes.number.isRequired,
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
  onSetChartBaseHeight: PropTypes.func,
  /**
   * Current Time Position to be showed (vertical line)
   */
  timePosition: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
};

SpeedSpaceChart.defaultProps = {
  dispatchUpdateMustRedraw: noop,
  dispatchUpdateTimePositionValues: noop,
  onSetChartBaseHeight: noop,
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
