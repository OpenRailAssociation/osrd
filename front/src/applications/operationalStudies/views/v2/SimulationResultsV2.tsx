import { useEffect, useState, useRef, useMemo } from 'react';

import { ChevronLeft, ChevronRight } from '@osrd-project/ui-icons';
import { Manchette as SpaceTimeChartWithManchette } from '@osrd-project/ui-manchette';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { Rnd } from 'react-rnd';

import type { SimulationResults, TrainSpaceTimeData } from 'applications/operationalStudies/types';
import type { TrainScheduleResult } from 'common/api/osrdEditoastApi';
import SimulationWarpedMap from 'common/Map/WarpedMap/SimulationWarpedMap';
import { getScaleDomainFromValuesV2 } from 'modules/simulationResult/components/ChartHelpers/getScaleDomainFromValues';
import SimulationResultsMapV2 from 'modules/simulationResult/components/SimulationResultsMapV2';
import SpaceCurvesSlopesV2 from 'modules/simulationResult/components/SpaceCurvesSlopes/SpaceCurvesSlopesV2';
import ProjectionLoadingMessage from 'modules/simulationResult/components/SpaceTimeChart/ProjectionLoadingMessage';
import useGetProjectedTrainOperationalPoints from 'modules/simulationResult/components/SpaceTimeChart/useGetProjectedTrainOperationalPoints';
import SpeedSpaceChartV2 from 'modules/simulationResult/components/SpeedSpaceChart/SpeedSpaceChartV2';
import TimeButtons from 'modules/simulationResult/components/TimeButtons';
import TrainDetailsV2 from 'modules/simulationResult/components/TrainDetailsV2';
import type { PositionScaleDomain } from 'modules/simulationResult/types';
import TimesStopsOutput from 'modules/timesStops/TimesStopsOutput';
import DriverTrainScheduleV2 from 'modules/trainschedule/components/DriverTrainScheduleV2/DriverTrainScheduleV2';
import { useFormattedOperationalPoints } from 'modules/trainschedule/useFormattedOperationalPoints';
import { updateViewport, type Viewport } from 'reducers/map';
import { getIsUpdating } from 'reducers/osrdsimulation/selectors';
import { useAppDispatch } from 'store';

const MAP_MIN_HEIGHT = 450;
const SPEED_SPACE_CHART_HEIGHT = 521.5;
const HANDLE_TAB_RESIZE_HEIGHT = 20;

type SimulationResultsV2Props = {
  collapsedTimetable: boolean;
  spaceTimeData?: TrainSpaceTimeData[];
  infraId?: number;
  trainScheduleUsedForProjection?: TrainScheduleResult;
  trainIdUsedForProjection?: number;
  simulationResults: SimulationResults;
  timetableTrainNb: number;
};

const SimulationResultsV2 = ({
  collapsedTimetable,
  spaceTimeData,
  infraId,
  trainScheduleUsedForProjection,
  trainIdUsedForProjection,
  simulationResults: {
    selectedTrainSchedule,
    selectedTrainRollingStock,
    selectedTrainPowerRestrictions,
    trainSimulation,
    pathProperties,
    path,
  },
  timetableTrainNb,
}: SimulationResultsV2Props) => {
  const { t } = useTranslation('simulation');
  const dispatch = useAppDispatch();
  const isUpdating = useSelector(getIsUpdating);

  const timeTableRef = useRef<HTMLDivElement | null>(null);
  const [extViewport, setExtViewport] = useState<Viewport | undefined>(undefined);
  const [showWarpedMap, setShowWarpedMap] = useState(false);

  const [speedSpaceChartContainerHeight, setSpeedSpaceChartContainerHeight] =
    useState(SPEED_SPACE_CHART_HEIGHT);
  const [heightOfSimulationMap] = useState(MAP_MIN_HEIGHT);
  const [heightOfSpaceCurvesSlopesChart, setHeightOfSpaceCurvesSlopesChart] = useState(150);
  const [initialHeightOfSpaceCurvesSlopesChart, setInitialHeightOfSpaceCurvesSlopesChart] =
    useState(heightOfSpaceCurvesSlopesChart);

  // X scale domain shared between SpeedSpace and SpaceCurvesSlopes charts.
  const [positionScaleDomain, setPositionScaleDomain] = useState<PositionScaleDomain>({
    initial: [],
    current: [],
    source: undefined,
  });

  const {
    operationalPoints,
    loading: formattedOpPointsLoading,
    baseOrEco,
    setBaseOrEco,
  } = useFormattedOperationalPoints(
    selectedTrainSchedule,
    trainSimulation,
    pathProperties,
    infraId
  );

  const projectedOperationalPoints = useGetProjectedTrainOperationalPoints(
    trainScheduleUsedForProjection,
    trainIdUsedForProjection,
    infraId
  );

  const trainUsedForProjectionSpaceTimeData = useMemo(
    () =>
      selectedTrainSchedule && spaceTimeData
        ? spaceTimeData.find((_train) => _train.id === selectedTrainSchedule.id)
        : undefined,
    [selectedTrainSchedule, spaceTimeData]
  );

  useEffect(() => {
    if (extViewport !== undefined) {
      dispatch(
        updateViewport({
          ...extViewport,
        })
      );
    }
  }, [extViewport]);

  useEffect(() => {
    if (trainSimulation && trainSimulation.status === 'success') {
      const { positions } = trainSimulation.final_output;
      const newPositionsScaleDomain = getScaleDomainFromValuesV2(positions);
      setPositionScaleDomain({
        initial: newPositionsScaleDomain,
        current: newPositionsScaleDomain,
      });
    }
  }, [trainSimulation]);

  if (!trainSimulation) return null;

  if (trainSimulation.status !== 'success' && !isUpdating) return null;

  return (
    <div className="simulation-results">
      {/* SIMULATION : STICKY BAR */}
      {selectedTrainSchedule && (
        <div
          className={cx('osrd-simulation-sticky-bar', {
            'with-collapsed-timetable': collapsedTimetable,
          })}
        >
          <div className="row">
            <div className="col-xl-4">
              <TimeButtons departureTime={selectedTrainSchedule.start_time} />
            </div>
            {trainUsedForProjectionSpaceTimeData && (
              <TrainDetailsV2 projectedTrain={trainUsedForProjectionSpaceTimeData} />
            )}
          </div>
        </div>
      )}

      {/* SIMULATION : SPACE TIME CHART */}

      <div className="simulation-warped-map d-flex flex-row align-items-stretch mb-2 bg-white">
        {spaceTimeData && spaceTimeData.length > 0 && pathProperties && (
          <>
            <button
              type="button"
              className="show-warped-map-button my-3 ml-3 mr-1"
              aria-label={t('toggleWarpedMap')}
              title={t('toggleWarpedMap')}
              onClick={() => setShowWarpedMap(!showWarpedMap)}
            >
              {showWarpedMap ? <ChevronLeft /> : <ChevronRight />}
            </button>
            <SimulationWarpedMap collapsed={!showWarpedMap} pathProperties={pathProperties} />

            <div className="osrd-simulation-container d-flex flex-grow-1 flex-shrink-1">
              <div className="chart-container">
                {spaceTimeData.length !== timetableTrainNb && (
                  <ProjectionLoadingMessage
                    projectedTrainsNb={spaceTimeData.length}
                    totalTrains={timetableTrainNb}
                  />
                )}
                <SpaceTimeChartWithManchette
                  operationalPoints={projectedOperationalPoints}
                  projectPathTrainResult={spaceTimeData.filter(
                    (train) => train.space_time_curves.length > 0
                  )}
                  selectedProjection={selectedTrainSchedule?.id}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* TRAIN : SPACE SPEED CHART */}
      {selectedTrainRollingStock && trainSimulation && pathProperties && selectedTrainSchedule && (
        <div className="osrd-simulation-container d-flex mb-2 speedspacechart-container">
          <div
            className="chart-container"
            style={{
              height: `${speedSpaceChartContainerHeight + HANDLE_TAB_RESIZE_HEIGHT}px`,
            }}
          >
            <SpeedSpaceChartV2
              trainSimulation={trainSimulation}
              selectedTrainPowerRestrictions={selectedTrainPowerRestrictions}
              pathProperties={pathProperties}
              heightOfSpeedSpaceChartContainer={speedSpaceChartContainerHeight}
              setHeightOfSpeedSpaceChartContainer={setSpeedSpaceChartContainerHeight}
            />
          </div>
        </div>
      )}

      {/* TIME STOPS TABLE */}
      {selectedTrainSchedule &&
        trainSimulation.status === 'success' &&
        pathProperties &&
        operationalPoints &&
        infraId && (
          <div className="osrd-simulation-container mb-2">
            <TimesStopsOutput
              simulatedTrain={trainSimulation}
              pathProperties={pathProperties}
              operationalPoints={operationalPoints.finalOutput}
              selectedTrainSchedule={selectedTrainSchedule}
              path={path}
              dataIsLoading={formattedOpPointsLoading}
            />
          </div>
        )}

      {/* TRAIN : CURVES & SLOPES */}
      {trainSimulation.status === 'success' && pathProperties && selectedTrainSchedule && (
        <div className="osrd-simulation-container d-flex mb-2">
          <div
            className="chart-container"
            style={{ height: `${heightOfSpaceCurvesSlopesChart}px` }}
          >
            <Rnd
              default={{
                x: 0,
                y: 0,
                width: '100%',
                height: `${heightOfSpaceCurvesSlopesChart}px`,
              }}
              disableDragging
              enableResizing={{
                bottom: true,
              }}
              onResizeStart={() =>
                setInitialHeightOfSpaceCurvesSlopesChart(heightOfSpaceCurvesSlopesChart)
              }
              onResize={(_e, _dir, _refToElement, delta) => {
                setHeightOfSpaceCurvesSlopesChart(
                  initialHeightOfSpaceCurvesSlopesChart + delta.height
                );
              }}
            >
              <SpaceCurvesSlopesV2
                initialHeight={heightOfSpaceCurvesSlopesChart}
                trainSimulation={trainSimulation}
                pathProperties={pathProperties}
                sharedXScaleDomain={positionScaleDomain}
                setSharedXScaleDomain={setPositionScaleDomain}
                departureTime={selectedTrainSchedule.start_time}
              />
            </Rnd>
          </div>
        </div>
      )}

      {/* SIMULATION : MAP */}
      <div ref={timeTableRef}>
        <div className="osrd-simulation-container mb-2">
          <div className="osrd-simulation-map" style={{ height: `${heightOfSimulationMap}px` }}>
            <SimulationResultsMapV2
              setExtViewport={setExtViewport}
              geometry={pathProperties?.geometry}
              trainSimulation={
                selectedTrainSchedule && trainSimulation
                  ? {
                      ...trainSimulation,
                      trainId: selectedTrainSchedule.id,
                      startTime: selectedTrainSchedule.start_time,
                    }
                  : undefined
              }
            />
          </div>
        </div>
      </div>

      {/* TRAIN : DRIVER TRAIN SCHEDULE */}
      {selectedTrainSchedule &&
        trainSimulation &&
        pathProperties &&
        selectedTrainRollingStock &&
        operationalPoints &&
        infraId && (
          <div className="osrd-simulation-container mb-2">
            <DriverTrainScheduleV2
              train={selectedTrainSchedule}
              simulatedTrain={trainSimulation}
              pathProperties={pathProperties}
              rollingStock={selectedTrainRollingStock}
              operationalPoints={operationalPoints}
              formattedOpPointsLoading={formattedOpPointsLoading}
              baseOrEco={baseOrEco}
              setBaseOrEco={setBaseOrEco}
            />
          </div>
        )}
    </div>
  );
};

export default SimulationResultsV2;
