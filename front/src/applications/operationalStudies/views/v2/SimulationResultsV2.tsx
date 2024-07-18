import React, { useEffect, useState, useRef, useMemo } from 'react';

import { ChevronLeft, ChevronRight } from '@osrd-project/ui-icons';
import { Manchette as SpaceTimeChartWithManchette } from '@osrd-project/ui-manchette';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { Rnd } from 'react-rnd';

import useSimulationResults from 'applications/operationalStudies/hooks/useSimulationResults';
import type { TrainSpaceTimeData } from 'applications/operationalStudies/types';
import type { ProjectPathTrainResult } from 'common/api/osrdEditoastApi';
import SimulationWarpedMap from 'common/Map/WarpedMap/SimulationWarpedMap';
import { getScaleDomainFromValuesV2 } from 'modules/simulationResult/components/ChartHelpers/getScaleDomainFromValues';
import SimulationResultsMapV2 from 'modules/simulationResult/components/SimulationResultsMapV2';
import SpaceCurvesSlopesV2 from 'modules/simulationResult/components/SpaceCurvesSlopes/SpaceCurvesSlopesV2';
import { useStoreDataForSpaceTimeChartV2 } from 'modules/simulationResult/components/SpaceTimeChart/useStoreDataForSpaceTimeChart';
import SpeedSpaceChartV2 from 'modules/simulationResult/components/SpeedSpaceChart/SpeedSpaceChartV2';
import TimeButtons from 'modules/simulationResult/components/TimeButtons';
import TrainDetailsV2 from 'modules/simulationResult/components/TrainDetailsV2';
import type { PositionScaleDomain } from 'modules/simulationResult/types';
import DriverTrainScheduleV2 from 'modules/trainschedule/components/DriverTrainScheduleV2/DriverTrainScheduleV2';
import { updateViewport, type Viewport } from 'reducers/map';
import { getIsUpdating } from 'reducers/osrdsimulation/selectors';
// TIMELINE DISABLED // import TimeLine from 'modules/simulationResult/components/TimeLine/TimeLine';
import { useAppDispatch } from 'store';
import { convertIsoUtcToLocalTime } from 'utils/date';

const MAP_MIN_HEIGHT = 450;

type SimulationResultsV2Props = {
  collapsedTimetable: boolean;
  spaceTimeData: TrainSpaceTimeData[];
};

const SimulationResultsV2 = ({ collapsedTimetable, spaceTimeData }: SimulationResultsV2Props) => {
  const { t } = useTranslation('simulation');
  const dispatch = useAppDispatch();
  // TIMELINE DISABLED // const { chart } = useSelector(getOsrdSimulation);
  const isUpdating = useSelector(getIsUpdating);
  const { infraId } = useStoreDataForSpaceTimeChartV2();

  const timeTableRef = useRef<HTMLDivElement | null>(null);
  const [extViewport, setExtViewport] = useState<Viewport | undefined>(undefined);
  const [showWarpedMap, setShowWarpedMap] = useState(false);

  const [heightOfSpeedSpaceChart, setHeightOfSpeedSpaceChart] = useState(250);
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
    selectedTrain,
    selectedTrainRollingStock,
    selectedTrainPowerRestrictions,
    trainSimulation,
    pathProperties,
  } = useSimulationResults();

  const manchetteSpaceTimeData: ProjectPathTrainResult[] = useMemo(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      spaceTimeData.map(({ id, trainName, departure_time, ...rest }) => ({
        ...rest,
        departure_time: `${convertIsoUtcToLocalTime(departure_time).slice(0, -6)}Z` || '',
      })),
    [spaceTimeData]
  );

  const trainUsedForProjectionSpaceTimeData = useMemo(
    () =>
      selectedTrain ? spaceTimeData.find((_train) => _train.id === selectedTrain.id) : undefined,
    [selectedTrain, spaceTimeData]
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

  if (!trainSimulation || spaceTimeData.length === 0) return null;

  if (trainSimulation.status !== 'success' && !isUpdating) return null;

  return (
    <div className="simulation-results">
      {/* SIMULATION : STICKY BAR */}
      {selectedTrain && (
        <div
          className={cx('osrd-simulation-sticky-bar', {
            'with-collapsed-timetable': collapsedTimetable,
          })}
        >
          <div className="row">
            <div className="col-xl-4">
              <TimeButtons departureTime={selectedTrain.start_time} />
            </div>
            {trainUsedForProjectionSpaceTimeData && (
              <TrainDetailsV2 projectedTrain={trainUsedForProjectionSpaceTimeData} />
            )}
          </div>
        </div>
      )}

      {/* SIMULATION: TIMELINE — TEMPORARILY DISABLED
      {simulation.trains.length && (
        <TimeLine
          timeScaleDomain={timeScaleDomain}
          selectedTrainId={selectedTrain?.id || simulation.trains[0].id}
          trains={simulation.trains as SimulationReport[]}
          onTimeScaleDomainChange={setTimeScaleDomain}
        />
      )}
      */}

      {/* SIMULATION : SPACE TIME CHART */}
      {manchetteSpaceTimeData.length > 0 && pathProperties && (
        <div className="simulation-warped-map d-flex flex-row align-items-stretch mb-2 bg-white">
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
              <SpaceTimeChartWithManchette
                operationalPoints={pathProperties.operationalPoints}
                projectPathTrainResult={manchetteSpaceTimeData}
              />
            </div>
          </div>
        </div>
      )}

      {/* TRAIN : SPACE SPEED CHART */}
      {selectedTrainRollingStock && trainSimulation && pathProperties && selectedTrain && (
        <div className="osrd-simulation-container d-flex mb-2">
          <div className="chart-container" style={{ height: `${heightOfSpeedSpaceChart}px` }}>
            <SpeedSpaceChartV2
              initialHeight={heightOfSpeedSpaceChart}
              onSetChartBaseHeight={setHeightOfSpeedSpaceChart}
              trainRollingStock={selectedTrainRollingStock}
              trainSimulation={trainSimulation}
              selectedTrainPowerRestrictions={selectedTrainPowerRestrictions}
              pathProperties={pathProperties}
              sharedXScaleDomain={positionScaleDomain}
              setSharedXScaleDomain={setPositionScaleDomain}
              departureTime={selectedTrain.start_time}
            />
          </div>
        </div>
      )}

      {/* TRAIN : CURVES & SLOPES */}
      {trainSimulation.status === 'success' && pathProperties && selectedTrain && (
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
                departureTime={selectedTrain.start_time}
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
                selectedTrain && trainSimulation
                  ? {
                      ...trainSimulation,
                      trainId: selectedTrain.id,
                      startTime: selectedTrain.start_time,
                    }
                  : undefined
              }
            />
          </div>
        </div>
      </div>

      {/* TRAIN : DRIVER TRAIN SCHEDULE */}
      {selectedTrain &&
        trainSimulation &&
        pathProperties &&
        selectedTrainRollingStock &&
        infraId && (
          <div className="osrd-simulation-container mb-2">
            <DriverTrainScheduleV2
              train={selectedTrain}
              simulatedTrain={trainSimulation}
              pathProperties={pathProperties}
              rollingStock={selectedTrainRollingStock}
              infraId={infraId}
            />
          </div>
        )}
    </div>
  );
};

export default SimulationResultsV2;
