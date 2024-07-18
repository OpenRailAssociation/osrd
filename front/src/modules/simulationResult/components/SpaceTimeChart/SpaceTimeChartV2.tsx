import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';

import { noop } from 'lodash';
import { useTranslation } from 'react-i18next';
import { CgLoadbar } from 'react-icons/cg';
import { GiResize } from 'react-icons/gi';
import { Rnd } from 'react-rnd';

import type { TrainSpaceTimeData } from 'applications/operationalStudies/types';
import { getSpaceTimeChartData } from 'applications/operationalStudies/views/v2/getSimulationResultsV2';
import { osrdEditoastApi, type TrainScheduleResult } from 'common/api/osrdEditoastApi';
import {
  enableInteractivityV2,
  traceVerticalLine,
} from 'modules/simulationResult/components/ChartHelpers/enableInteractivity';
import { useChartSynchronizerV2 } from 'modules/simulationResult/components/ChartSynchronizer';
import ChartModal from 'modules/simulationResult/components/SpaceTimeChart/ChartModal';
import { createTrainV2 } from 'modules/simulationResult/components/SpaceTimeChart/createTrain';
import { drawAllTrainsV2 } from 'modules/simulationResult/components/SpaceTimeChart/d3Helpers';
import { CHART_AXES } from 'modules/simulationResult/consts';
import type { TimeScaleDomain } from 'modules/simulationResult/types';
import type { Chart } from 'reducers/osrdsimulation/types';
import { dateIsInRange, isoDateToMs, formatToIsoDate } from 'utils/date';

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
  setTrainSpaceTimeData: React.Dispatch<React.SetStateAction<TrainSpaceTimeData[]>>;
  deactivateChartSynchronization?: boolean;
};

const SpaceTimeChartV2 = ({
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
  setTrainSpaceTimeData,
  deactivateChartSynchronization,
}: SpaceTimeChartV2Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const rndContainerRef = useRef<Rnd>(null);
  const { t } = useTranslation('simulation');

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

  const selectedTrainSimulation = useMemo(
    () => simulation.find((train) => train.id === selectedTrain.id),
    [simulation, selectedTrain.id]
  );

  /* coordinate the vertical cursors with other graphs (GEV for instance) */
  const { updateTimePosition } = useChartSynchronizerV2(
    (newTimePosition, positionValues) => {
      if (deactivateChartSynchronization) {
        if (chart) {
          chart.svg.selectAll('#horizontal-line').attr('y1', chart.y(0)).attr('y2', chart.y(0));
          chart.svg.selectAll('#vertical-line').attr('x1', chart.x(0)).attr('x2', chart.x(0));
        }
      } else if (
        timeScaleDomain &&
        timeScaleDomain?.range &&
        dateIsInRange(newTimePosition, timeScaleDomain.range)
      ) {
        traceVerticalLine(chart, CHART_AXES.SPACE_TIME, positionValues, newTimePosition, rotate);
      }
    },
    'space-time',
    [chart, rotate, timeScaleDomain]
  );

  /**
   * Shift a train after a drag and drop or when using the modal to update the departure time
   */
  const shiftTrain = useCallback(
    (offset: number) => {
      if (offset) {
        const newDepartureTime = formatToIsoDate(
          isoDateToMs(selectedTrain.start_time) + offset * 1000
        );

        const updatedTrainPayload = { ...selectedTrain, start_time: newDepartureTime };

        updateTrainSchedule({ id: selectedTrain.id, trainScheduleForm: updatedTrainPayload }).then(
          () => {
            setTrainResultsToFetch([selectedTrain.id]);
            getSpaceTimeChartData(
              [selectedTrain.id],
              trainIdUsedForProjection!,
              infraId!,
              setTrainSpaceTimeData,
              setTrainResultsToFetch
            );
          }
        );
      }
    },
    [selectedTrain, trainIdUsedForProjection]
  );

  /*
   * INPUT UPDATES
   *
   * take into account an input update
   */
  useEffect(() => {
    setTrainSimulations(simulation);
  }, [simulation]);

  useEffect(() => {
    setSelectedTrain(inputSelectedTrain);
  }, [inputSelectedTrain]);

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
   * dragOffset is in seconds
   */
  useEffect(() => {
    shiftTrain(dragOffset);
  }, [dragOffset]);

  /* redraw the trains ifformating
   * - the simulation trains or the selected train have changed
   * - the chart is rotated or centered (reset)
   * - the window or the chart have been resized (height)
   */
  useEffect(() => {
    redrawChart();
  }, [resetChart, rotate, selectedTrain.id, trainSimulations, operationalPoints, height]);

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
    if (chart && selectedTrainSimulation) {
      const newTimeScaleRange = (rotate ? chart.y.domain() : chart.x.domain()) as [Date, Date];

      if (setTimeScaleDomain) {
        setTimeScaleDomain({
          range: newTimeScaleRange,
          source: 'SpaceTimeChart',
        });
      }

      // combination oif simulationresponse and projectpathtrainresult trains ?
      const dataSimulation = createTrainV2(selectedTrainSimulation);
      enableInteractivityV2(
        chart,
        dataSimulation,
        CHART_AXES.SPACE_TIME,
        rotate,
        setChart,
        simulationIsPlaying,
        updateTimePosition,
        newTimeScaleRange,
        selectedTrain.start_time,
        undefined,
        undefined,
        deactivateChartSynchronization
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
            offsetTimeByDragging={shiftTrain}
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
