import React, { useEffect, useState, useRef } from 'react';

import { ChevronLeft, ChevronRight } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { Rnd } from 'react-rnd';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import SimulationWarpedMap from 'common/Map/WarpedMap/SimulationWarpedMap';
import getScaleDomainFromValues from 'modules/simulationResult/components/ChartHelpers/getScaleDomainFromValues';
import SimulationResultsMap from 'modules/simulationResult/components/SimulationResultsMap';
import SpaceCurvesSlopes from 'modules/simulationResult/components/SpaceCurvesSlopes';
import SpaceTimeChart from 'modules/simulationResult/components/SpaceTimeChart/SpaceTimeChart';
import { useStoreDataForSpaceTimeChart } from 'modules/simulationResult/components/SpaceTimeChart/useStoreDataForSpaceTimeChart';
import SpeedSpaceChart from 'modules/simulationResult/components/SpeedSpaceChart/SpeedSpaceChart';
import TimeButtons from 'modules/simulationResult/components/TimeButtons';
import TrainDetails from 'modules/simulationResult/components/TrainDetails';
import type { PositionScaleDomain, TimeScaleDomain } from 'modules/simulationResult/types';
import DriverTrainSchedule from 'modules/trainschedule/components/DriverTrainSchedule/DriverTrainSchedule';
import { updateViewport, type Viewport } from 'reducers/map';
import { updateSelectedProjection, updateSimulation } from 'reducers/osrdsimulation/actions';
import { getIsUpdating } from 'reducers/osrdsimulation/selectors';
import {
  persistentRedoSimulation,
  persistentUndoSimulation,
} from 'reducers/osrdsimulation/simulation';
// TIMELINE DISABLED // import TimeLine from 'modules/simulationResult/components/TimeLine/TimeLine';
import type { Train } from 'reducers/osrdsimulation/types';
import { useAppDispatch } from 'store';

const MAP_MIN_HEIGHT = 450;

type SimulationResultsProps = {
  collapsedTimetable: boolean;
  setTrainResultsToFetch: (trainSchedulesIDs?: number[]) => void;
};

export default function SimulationResults({
  collapsedTimetable,
  setTrainResultsToFetch,
}: SimulationResultsProps) {
  const { t } = useTranslation('simulation');
  const dispatch = useAppDispatch();

  // TIMELINE DISABLED // const { chart } = useSelector(getOsrdSimulation);
  const isUpdating = useSelector(getIsUpdating);

  const timeTableRef = useRef<HTMLDivElement | null>(null);
  const [extViewport, setExtViewport] = useState<Viewport | undefined>(undefined);
  const [showWarpedMap, setShowWarpedMap] = useState(false);

  const [heightOfSpaceTimeChart, setHeightOfSpaceTimeChart] = useState(600);
  const [heightOfSpeedSpaceChart, setHeightOfSpeedSpaceChart] = useState(250);
  const [heightOfSimulationMap] = useState(MAP_MIN_HEIGHT);
  const [heightOfSpaceCurvesSlopesChart, setHeightOfSpaceCurvesSlopesChart] = useState(150);
  const [initialHeightOfSpaceCurvesSlopesChart, setInitialHeightOfSpaceCurvesSlopesChart] =
    useState(heightOfSpaceCurvesSlopesChart);

  const [timeScaleDomain, setTimeScaleDomain] = useState<TimeScaleDomain>({
    range: undefined,
    source: undefined,
  });

  // X scale domain shared between SpeedSpace and SpaceCurvesSlopes charts.
  const [positionScaleDomain, setPositionScaleDomain] = useState<PositionScaleDomain>({
    initial: [],
    current: [],
    source: undefined,
  });

  const {
    allowancesSettings,
    selectedTrain,
    selectedProjection,
    simulation,
    simulationIsPlaying,
    dispatchUpdateSelectedTrainId,
    dispatchPersistentUpdateSimulation,
  } = useStoreDataForSpaceTimeChart();

  const { data: selectedTrainSchedule } = osrdEditoastApi.endpoints.getTrainScheduleById.useQuery(
    {
      id: selectedTrain?.id as number,
    },
    { skip: !selectedTrain }
  );

  const { data: selectedTrainRollingStock } =
    osrdEditoastApi.endpoints.getLightRollingStockByRollingStockId.useQuery(
      {
        rollingStockId: selectedTrainSchedule?.rolling_stock_id as number,
      },
      { skip: !selectedTrainSchedule }
    );

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'z' && e.metaKey) {
      dispatch(persistentUndoSimulation());
    }
    if (e.key === 'e' && e.metaKey) {
      dispatch(persistentRedoSimulation());
    }
  };

  useEffect(() => {
    // Setup the listener to undi /redo
    window.addEventListener('keydown', handleKey);
    return function cleanup() {
      window.removeEventListener('keydown', handleKey);
      dispatch(updateSelectedProjection(undefined));
      dispatch(updateSimulation({ trains: [] }));
    };
  }, []);

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
    if (selectedTrain) {
      const positions = selectedTrain.base.speeds.map((speed) => speed.position);
      const newPositionsScaleDomain = getScaleDomainFromValues(positions);
      setPositionScaleDomain({
        initial: newPositionsScaleDomain,
        current: newPositionsScaleDomain,
      });
    }
  }, [selectedTrain]);

  return simulation.trains.length === 0 && !isUpdating ? null : (
    <div className="simulation-results">
      {/* SIMULATION : STICKY BAR */}
      <div
        className={cx('osrd-simulation-sticky-bar', {
          'with-collapsed-timetable': collapsedTimetable,
        })}
      >
        <div className="row">
          <div className="col-xl-4">{selectedTrain && <TimeButtons />}</div>
          <div className="col-xl-8 d-flex justify-content-end mt-2 mt-xl-0">
            <TrainDetails />
          </div>
        </div>
      </div>

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
        <SimulationWarpedMap collapsed={!showWarpedMap} />

        <div className="osrd-simulation-container d-flex flex-grow-1 flex-shrink-1">
          <div className="chart-container" style={{ height: `${heightOfSpaceTimeChart}px` }}>
            {simulation.trains.length > 0 && (
              <SpaceTimeChart
                allowancesSettings={allowancesSettings}
                inputSelectedTrain={selectedTrain}
                selectedProjection={selectedProjection}
                simulation={simulation}
                simulationIsPlaying={simulationIsPlaying}
                initialHeight={heightOfSpaceTimeChart}
                onSetBaseHeight={setHeightOfSpaceTimeChart}
                dispatchUpdateSelectedTrainId={dispatchUpdateSelectedTrainId}
                dispatchPersistentUpdateSimulation={dispatchPersistentUpdateSimulation}
                setTrainResultsToFetch={setTrainResultsToFetch}
                timeScaleDomain={timeScaleDomain}
                setTimeScaleDomain={setTimeScaleDomain}
              />
            )}
          </div>
        </div>
      </div>

      {/* TRAIN : SPACE SPEED CHART */}
      {selectedTrain && (
        <div className="osrd-simulation-container d-flex mb-2">
          <div className="chart-container" style={{ height: `${heightOfSpeedSpaceChart}px` }}>
            <SpeedSpaceChart
              initialHeight={heightOfSpeedSpaceChart}
              onSetChartBaseHeight={setHeightOfSpeedSpaceChart}
              selectedTrain={selectedTrain}
              trainRollingStock={selectedTrainRollingStock}
              sharedXScaleDomain={positionScaleDomain}
              setSharedXScaleDomain={setPositionScaleDomain}
            />
          </div>
        </div>
      )}

      {/* TRAIN : CURVES & SLOPES */}
      <div className="osrd-simulation-container d-flex mb-2">
        <div className="chart-container" style={{ height: `${heightOfSpaceCurvesSlopesChart}px` }}>
          {selectedTrain && (
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
              <SpaceCurvesSlopes
                initialHeight={heightOfSpaceCurvesSlopesChart}
                selectedTrain={selectedTrain as Train} // TODO: remove Train interface
                sharedXScaleDomain={positionScaleDomain}
                setSharedXScaleDomain={setPositionScaleDomain}
              />
            </Rnd>
          )}
        </div>
      </div>

      {/* TRAIN : DRIVER TRAIN SCHEDULE */}
      {selectedTrain && selectedTrainRollingStock && (
        <div className="osrd-simulation-container mb-2">
          <DriverTrainSchedule
            train={selectedTrain as Train} // TODO: remove Train interface
            rollingStock={selectedTrainRollingStock}
          />
        </div>
      )}

      {/* SIMULATION : MAP */}
      <div ref={timeTableRef}>
        <div className="osrd-simulation-container mb-2">
          <div className="osrd-simulation-map" style={{ height: `${heightOfSimulationMap}px` }}>
            <SimulationResultsMap setExtViewport={setExtViewport} />
          </div>
        </div>
      </div>
    </div>
  );
}
