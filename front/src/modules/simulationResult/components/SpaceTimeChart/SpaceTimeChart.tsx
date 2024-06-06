import React, { useEffect, useRef, useState, useCallback } from 'react';

import { noop } from 'lodash';
import { useTranslation } from 'react-i18next';
import { CgLoadbar } from 'react-icons/cg';
import { GiResize } from 'react-icons/gi';
import { Rnd } from 'react-rnd';

import type { SimulationReport } from 'common/api/osrdEditoastApi';
import { timeShiftTrain } from 'modules/simulationResult/components/ChartHelpers/ChartHelpers';
import {
  enableInteractivity,
  traceVerticalLine,
} from 'modules/simulationResult/components/ChartHelpers/enableInteractivity';
import { useChartSynchronizer } from 'modules/simulationResult/components/ChartSynchronizer';
import ChartModal from 'modules/simulationResult/components/SpaceTimeChart/ChartModal';
import { isolatedCreateTrain as createTrain } from 'modules/simulationResult/components/SpaceTimeChart/createTrain';
import { drawAllTrains } from 'modules/simulationResult/components/SpaceTimeChart/d3Helpers';
import { CHART_AXES } from 'modules/simulationResult/consts';
import type { TimeScaleDomain } from 'modules/simulationResult/types';
import type {
  AllowancesSettings,
  Chart,
  OsrdSimulationState,
  SimulationSnapshot,
  Train,
} from 'reducers/osrdsimulation/types';
import { dateIsInRange } from 'utils/date';
import { sec2datetime, datetime2sec } from 'utils/timeManipulation';

import { SPACE_TIME_CHART_ID } from './consts';
import type { DispatchPersistentUpdateSimulation, DispatchUpdateSelectedTrainId } from './types';

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

export type SpaceTimeChartProps = {
  allowancesSettings?: AllowancesSettings;
  initialHeight?: number;
  inputSelectedTrain?: Train | SimulationReport;
  selectedProjection?: OsrdSimulationState['selectedProjection'];
  simulation?: SimulationSnapshot;
  simulationIsPlaying?: boolean;
  timeScaleDomain?: TimeScaleDomain;
  onSetBaseHeight?: (newHeight: number) => void;
  dispatchUpdateSelectedTrainId: DispatchUpdateSelectedTrainId;
  dispatchPersistentUpdateSimulation: DispatchPersistentUpdateSimulation;
  setTrainResultsToFetch?: (trainSchedulesIDs?: number[]) => void;
  setTimeScaleDomain?: (newTimeScaleDomain: TimeScaleDomain) => void;
};

export default function SpaceTimeChart(props: SpaceTimeChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const rndContainerRef = useRef<Rnd>(null);
  const { t } = useTranslation('simulation');

  const {
    allowancesSettings,
    initialHeight = 400,
    inputSelectedTrain,
    selectedProjection,
    simulation,
    simulationIsPlaying = false,
    timeScaleDomain,
    onSetBaseHeight = noop,
    dispatchUpdateSelectedTrainId,
    dispatchPersistentUpdateSimulation,
    setTrainResultsToFetch = noop,
    setTimeScaleDomain,
  } = props;

  const [baseHeight, setBaseHeight] = useState(initialHeight);
  const [chart, setChart] = useState<Chart | undefined>();
  const [dragOffset, setDragOffset] = useState(0);
  const [height, setHeight] = useState(initialHeight);
  const [resetChart, setResetChart] = useState(false);
  const [rotate, setRotate] = useState(false);
  const [selectedTrain, setSelectedTrain] = useState(inputSelectedTrain);
  const [showModal, setShowModal] = useState<'+' | '-' | ''>('');
  const [trainSimulations, setTrainSimulations] = useState<
    SimulationSnapshot['trains'] | undefined
  >(undefined);

  /* coordinate the vertical cursors with other graphs (GEV for instance) */
  const { timePosition, updateTimePosition } = useChartSynchronizer(
    (newTimePosition, positionValues) => {
      if (
        timeScaleDomain &&
        timeScaleDomain.range &&
        dateIsInRange(newTimePosition, timeScaleDomain.range)
      ) {
        traceVerticalLine(chart, CHART_AXES.SPACE_TIME, positionValues, newTimePosition, rotate);
      }
    },
    'space-time',
    [chart, rotate]
  );

  // Consequence of direct actions by component
  const onOffsetTimeByDragging = useCallback(
    (
      trains: SimulationSnapshot['trains'],
      offset: number,
      updateTrainResultsToFetch: (trainSchedulesIDs?: number[]) => void
    ) => {
      dispatchPersistentUpdateSimulation({ ...simulation, trains });

      // Sets the train which needs its results to be updated
      // We know it is always the selected train because when dragging one, it gets the selection
      if (selectedTrain && updateTrainResultsToFetch) updateTrainResultsToFetch([selectedTrain.id]);

      if (timePosition && offset) {
        const newTimePosition = sec2datetime(datetime2sec(timePosition) + offset);
        updateTimePosition(newTimePosition);
      }
    },
    [selectedTrain, timePosition, updateTimePosition]
  );

  const dragShiftTrain = useCallback(
    (offset: number) => {
      if (trainSimulations) {
        const trains = trainSimulations.map((train) =>
          train.id === selectedTrain?.id ? timeShiftTrain(train as Train, offset) : train
        ) as Train[];
        setTrainSimulations(trains);
        onOffsetTimeByDragging(trains, offset, setTrainResultsToFetch);
      }
    },
    [trainSimulations, selectedTrain, onOffsetTimeByDragging]
  );

  /*
   * INPUT UPDATES
   *
   * take into account an input update
   */
  useEffect(() => {
    if (simulation) {
      setTrainSimulations(simulation.trains);
    }
  }, [simulation?.trains]);

  useEffect(() => {
    // avoid useless re-render if selectedTrain is already correct
    if (selectedTrain?.id !== inputSelectedTrain?.id) {
      setSelectedTrain(inputSelectedTrain);
    }
  }, [inputSelectedTrain?.id]);

  /*
   * ACTIONS HANDLE
   *
   * everything should be done by Hoc, has no direct effect on Comp behavior
   */
  const toggleRotation = () => {
    if (chart) {
      const newRotate = !rotate;
      setChart({ ...chart, x: chart.y, y: chart.x, rotate: newRotate });
      setRotate(newRotate);
    }
  };

  /*
   * shift the train after a drag and drop
   * dragOffset is in Seconds !! (typecript is nice)
   */
  useEffect(() => {
    dragShiftTrain(dragOffset);
  }, [dragOffset]);

  const redrawChart = () => {
    if (trainSimulations && allowancesSettings) {
      const trainsToDraw = trainSimulations.map((train) =>
        createTrain(CHART_AXES.SPACE_TIME, train as Train)
      );

      const newDrawnedChart = drawAllTrains(
        allowancesSettings,
        chart,
        dispatchUpdateSelectedTrainId,
        height,
        ref,
        resetChart,
        rotate,
        selectedProjection,
        selectedTrain as Train,
        setDragOffset,
        trainSimulations as Train[],
        trainsToDraw
      );
      setChart(newDrawnedChart);
      setResetChart(false);
    }
  };

  /* redraw the trains if
   * - the simulation trains or the selected train have changed
   * - the chart is rotated or centered (reset)
   * - the window or the chart have been resized (height)
   */
  useEffect(() => {
    redrawChart();
  }, [resetChart, rotate, selectedTrain, trainSimulations, height]);

  /* redraw the trains if the time scale range has changed from Timeline */
  useEffect(() => {
    if (chart && timeScaleDomain && timeScaleDomain.source !== 'SpaceTimeChart') {
      const currentTimeRange = timeScaleDomain.range;
      if (currentTimeRange) {
        chart.x.domain(currentTimeRange);
        redrawChart();
      }
    }
  }, [timeScaleDomain]);

  /* add behaviour on zoom and mousemove/mouseover/wheel on the new chart each time the chart changes */
  useEffect(() => {
    if (chart && selectedTrain) {
      const newTimeScaleRange = (rotate ? chart.y.domain() : chart.x.domain()) as [Date, Date];

      if (setTimeScaleDomain) {
        setTimeScaleDomain({
          range: newTimeScaleRange,
          source: 'SpaceTimeChart',
        });
      }

      const dataSimulation = createTrain(CHART_AXES.SPACE_TIME, selectedTrain as Train);
      enableInteractivity(
        chart,
        dataSimulation,
        CHART_AXES.SPACE_TIME,
        rotate,
        setChart,
        simulationIsPlaying,
        updateTimePosition,
        newTimeScaleRange
      );
    }
  }, [chart]);

  const debounceResize = () => {
    let debounceTimeoutId;
    clearTimeout(debounceTimeoutId);
    debounceTimeoutId = setTimeout(() => {
      redrawChart();
    }, 15);
  };

  /* add behaviours:
   * - redraw the graph when resized horizontally (window resized)
   */
  useEffect(() => {
    window.addEventListener('resize', debounceResize);
    return () => {
      window.removeEventListener('resize', debounceResize);
    };
  }, [chart]);

  return (
    <Rnd
      ref={rndContainerRef}
      default={{
        x: 0,
        y: 0,
        width: '100%',
        height: `${height}px`,
      }}
      minHeight={CHART_MIN_HEIGHT}
      disableDragging
      enableResizing={{
        bottom: true,
      }}
      onResizeStart={() => {
        setBaseHeight(height);
        onSetBaseHeight(height);
      }}
      onResize={(_e, _dir, _refToElement, delta) => {
        setHeight(baseHeight + delta.height);
        onSetBaseHeight(baseHeight + delta.height);
      }}
    >
      <div
        id={`container-${SPACE_TIME_CHART_ID}`}
        className="spacetime-chart chart"
        style={{ height: `100%` }}
      >
        {showModal !== '' && selectedTrain && (
          <ChartModal
            modificationKey={showModal}
            setShowModal={setShowModal}
            trainName={selectedTrain.name}
            offsetTimeByDragging={dragShiftTrain}
          />
        )}
        <div style={{ height: `100%` }} ref={ref} />
        <button
          type="button"
          className="btn-rounded btn-rounded-white box-shadow btn-rotate"
          aria-label={t('rotate')}
          title={t('rotate')}
          onClick={() => toggleRotation()}
        >
          <i className="icons-refresh" />
        </button>
        <button
          type="button"
          className="btn-rounded btn-rounded-white box-shadow btn-rotate mr-5"
          aria-label={t('reset')}
          title={t('reset')}
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
