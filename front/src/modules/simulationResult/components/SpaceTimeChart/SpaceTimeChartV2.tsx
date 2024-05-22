import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';

import { noop } from 'lodash';
import { useTranslation } from 'react-i18next';
import { CgLoadbar } from 'react-icons/cg';
import { GiResize } from 'react-icons/gi';
import { Rnd } from 'react-rnd';

import type { TrainSpaceTimeData } from 'applications/operationalStudies/types';
import { osrdEditoastApi, type TrainScheduleResult } from 'common/api/osrdEditoastApi';
import { useChartSynchronizerV2 } from 'modules/simulationResult/components/ChartHelpers/ChartSynchronizerV2';
import {
  enableInteractivityV2,
  traceVerticalLine,
} from 'modules/simulationResult/components/ChartHelpers/enableInteractivity';
import ChartModal from 'modules/simulationResult/components/SpaceTimeChart/ChartModal';
import { createTrainV2 } from 'modules/simulationResult/components/SpaceTimeChart/createTrain';
import { drawAllTrainsV2 } from 'modules/simulationResult/components/SpaceTimeChart/d3Helpers';
import { CHART_AXES } from 'modules/simulationResult/consts';
import type { TimeScaleDomain } from 'modules/simulationResult/types';
import type { Chart } from 'reducers/osrdsimulation/types';
import { dateIsInRange, isoDateToMs, formatToIsoDate } from 'utils/date';
import { sec2datetime, datetime2sec, ISO8601Duration2sec } from 'utils/timeManipulation';

import { SPACE_TIME_CHART_ID } from './consts';
import useGetProjectedTrainOperationalPoints from './hooks';
import type { DispatchUpdateSelectedTrainId } from './types';

const CHART_MIN_HEIGHT = 250;

/**
 * @summary A Important chart to study evolution of trains vs time and inside block occupancies
 *operationalPoints
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

export type SpaceTimeChartV2Props = {
  infraId?: number;
  initialHeight?: number;
  inputSelectedTrain: TrainScheduleResult;
  trainIdUsedForProjection?: number;
  simulation: TrainSpaceTimeData[];
  simulationIsPlaying?: boolean;
  timeScaleDomain?: TimeScaleDomain;
  onSetBaseHeight?: (newHeight: number) => void;
  dispatchUpdateSelectedTrainId: DispatchUpdateSelectedTrainId;
  setTrainResultsToFetch?: (trainSchedulesIDs?: number[]) => void;
  setTimeScaleDomain?: (newTimeScaleDomain: TimeScaleDomain) => void;
};

const SpaceTimeChartV2 = (props: SpaceTimeChartV2Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const rndContainerRef = useRef<Rnd>(null);
  const { t } = useTranslation('simulation');

  const {
    infraId,
    initialHeight = 400,
    inputSelectedTrain,
    trainIdUsedForProjection,
    simulation,
    simulationIsPlaying = false,
    timeScaleDomain,
    onSetBaseHeight = noop,
    dispatchUpdateSelectedTrainId,
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
  const [trainSimulations, setTrainSimulations] = useState<TrainSpaceTimeData[]>(simulation);

  const operationalPoints = useGetProjectedTrainOperationalPoints(
    trainIdUsedForProjection,
    infraId
  );

  const [updateTrainSchedule] = osrdEditoastApi.endpoints.putV2TrainScheduleById.useMutation();

  const selectedProjectedTrain = useMemo(
    () => simulation.find((train) => train.id === selectedTrain.id),
    [simulation, selectedTrain]
  );

  /* coordinate the vertical cursors with other graphs (GEV for instance) */
  const { timePosition, updateTimePosition } = useChartSynchronizerV2(
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
    [chart, rotate, selectedTrain]
  );

  // Consequence of direct actions by component
  const onOffsetTimeByDragging = useCallback(
    (offset: number) => {
      // Sets the train which needs its results to be updated
      // We know it is always the selected train because when dragging one, it gets the selection
      if (selectedTrain) setTrainResultsToFetch([selectedTrain.id]);

      if (timePosition && offset) {
        const newTimePosition = sec2datetime(datetime2sec(timePosition) + offset);
        updateTimePosition(newTimePosition);
      }
    },
    [selectedTrain, timePosition, updateTimePosition]
  );

  /*
   * INPUT UPDATES
   *
   * take into account an input update
   */
  useEffect(() => {
    if (simulation.length > 0) {
      setTrainSimulations(simulation);
    }
  }, [simulation]);

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

  const redrawChart = () => {
    if (trainSimulations && trainIdUsedForProjection) {
      // combination of trains data from projectpathtrainresults et simulationresponse ?
      const trainsToDraw = trainSimulations.map((train) => createTrainV2(train));

      const newDrawnedChart = drawAllTrainsV2(
        chart,
        dispatchUpdateSelectedTrainId,
        height,
        ref,
        resetChart,
        rotate,
        trainIdUsedForProjection,
        selectedTrain,
        setDragOffset,
        trainSimulations,
        trainsToDraw,
        operationalPoints // OPs from projected train
      );
      setChart(newDrawnedChart);
      setResetChart(false);
    }
  };

  /*
   * shift the train after a drag and drop
   * dragOffset is in Seconds !! (typecript is nice)
   */
  useEffect(() => {
    if (dragOffset) {
      const newDepartureTime = formatToIsoDate(
        isoDateToMs(selectedTrain.start_time) + dragOffset * 1000
      );

      // recalculer tous les schedules
      let schedule;
      if (selectedTrain.schedule) {
        schedule = selectedTrain.schedule.map((scheduleStep) => {
          if (scheduleStep.arrival) {
            // arrival is in format PTxxxS (PT3600S) as the number of seconds from the start
            const updatedArrivalInSeconds = ISO8601Duration2sec(scheduleStep.arrival) + dragOffset;
            const newScheduleStep = {
              ...scheduleStep,
              arrival: `PT${updatedArrivalInSeconds}S`,
            };
            return newScheduleStep;
          }
          return scheduleStep;
        });
      }

      const updatedTrainPayload = { ...selectedTrain, start_time: newDepartureTime, schedule };

      updateTrainSchedule({ id: selectedTrain.id, trainScheduleForm: updatedTrainPayload }).then(
        () => setTrainResultsToFetch([selectedTrain.id])
      );
    }
  }, [dragOffset]);

  /* redraw the trains ifformating
   * - the simulation trains or the selected train have changed
   * - the chart is rotated or centered (reset)
   * - the window or the chart have been resized (height)
   */
  useEffect(() => {
    redrawChart();
  }, [resetChart, rotate, selectedTrain, trainSimulations, operationalPoints, height]);

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
    if (chart && selectedProjectedTrain) {
      const newTimeScaleRange = (rotate ? chart.y.domain() : chart.x.domain()) as [Date, Date];

      if (setTimeScaleDomain) {
        setTimeScaleDomain({
          range: newTimeScaleRange,
          source: 'SpaceTimeChart',
        });
      }

      // combination oif simulationresponse and projectpathtrainresult trains ?
      const dataSimulation = createTrainV2(selectedProjectedTrain);
      enableInteractivityV2(
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
            trainName={selectedTrain.train_name}
            offsetTimeByDragging={onOffsetTimeByDragging}
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
};

export default SpaceTimeChartV2;
