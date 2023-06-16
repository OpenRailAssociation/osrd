import React, { useEffect, useState, useRef } from 'react';
import {
  persistentRedoSimulation,
  persistentUndoSimulation,
} from 'reducers/osrdsimulation/simulation';
import {
  updateMustRedraw,
  updateSelectedProjection,
  updateSimulation,
} from 'reducers/osrdsimulation/actions';
import { useDispatch, useSelector } from 'react-redux';

import Allowances from 'applications/operationalStudies/components/SimulationResults/Allowances/withOSRDData';

import SimulationResultsMap from 'applications/operationalStudies/components/SimulationResults/SimulationResultsMap';
import { Rnd } from 'react-rnd';
import SpaceCurvesSlopes from 'applications/operationalStudies/components/SimulationResults/SpaceCurvesSlopes';
import SpaceTimeChartIsolated from 'applications/operationalStudies/components/SimulationResults/SpaceTimeChart/withOSRDData';
import SpeedSpaceChart from 'applications/operationalStudies/components/SimulationResults/SpeedSpaceChart/withOSRDData';
import TimeButtons from 'applications/operationalStudies/components/SimulationResults/TimeButtons';
import TimeLine from 'applications/operationalStudies/components/SimulationResults/TimeLine/TimeLine';
import TrainDetails from 'applications/operationalStudies/components/SimulationResults/TrainDetails';
import getTimetable from 'applications/operationalStudies/components/Scenario/getTimetable';

import { RootState } from 'reducers';
import { updateViewport, Viewport } from 'reducers/map';
import { useTranslation } from 'react-i18next';
import DriverTrainSchedule from 'applications/operationalStudies/components/SimulationResults/DriverTrainSchedule/DriverTrainSchedule';
import { getTimetableID } from 'reducers/osrdconf/selectors';
import cx from 'classnames';
import ChartManager from 'common/charts/ChartManager';
import LinearChart from 'common/charts/components/LinearChart/Linearchart';

const MAP_MIN_HEIGHT = 450;

export default function SimulationResults({
  isDisplayed,
  collapsedTimetable,
}: {
  isDisplayed: boolean;
  collapsedTimetable: boolean;
}) {
  const { t } = useTranslation(['translation', 'simulation', 'allowances']);
  const timeTableRef = useRef<HTMLDivElement | null>(null);
  const [extViewport, setExtViewport] = useState<Viewport | undefined>(undefined);
  const [displayAllowances, setDisplayAllowances] = useState(false);

  const [heightOfSpaceTimeChart, setHeightOfSpaceTimeChart] = useState(400);

  const [heightOfSpeedSpaceChart, setHeightOfSpeedSpaceChart] = useState(250);

  const [heightOfSimulationMap] = useState(MAP_MIN_HEIGHT);

  const [heightOfSpaceCurvesSlopesChart, setHeightOfSpaceCurvesSlopesChart] = useState(150);
  const [initialHeightOfSpaceCurvesSlopesChart, setInitialHeightOfSpaceCurvesSlopesChart] =
    useState(heightOfSpaceCurvesSlopesChart);

  const isUpdating = useSelector((state: RootState) => state.osrdsimulation.isUpdating);
  const simulation = useSelector((state: RootState) => state.osrdsimulation.simulation.present);
  const selectedTrain = useSelector((state: RootState) => state.osrdsimulation.selectedTrain);
  const selectedProjection = useSelector(
    (state: RootState) => state.osrdsimulation.selectedProjection
  );
  const displaySimulation = useSelector(
    (state: RootState) => state.osrdsimulation.displaySimulation
  );
  const timetableID = useSelector(getTimetableID);
  const dispatch = useDispatch();

  const toggleAllowancesDisplay = () => {
    setDisplayAllowances(!displayAllowances);
  };

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
    if (timetableID && selectedProjection) {
      getTimetable(timetableID);
    }
    return function cleanup() {
      dispatch(updateSimulation({ trains: [] }));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjection, timetableID]);

  useEffect(() => {
    if (extViewport !== undefined) {
      dispatch(
        updateViewport({
          ...extViewport,
        })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extViewport]);

  const waitingLoader =
    (!simulation || simulation.trains.length === 0) && !isUpdating ? (
      <h1 className="text-center">{t('simulation:noData')}</h1>
    ) : null;

  if (!displaySimulation || isUpdating) {
    return <div className="pt-5 mt-5">{waitingLoader}</div>;
  }
  return (
    <div className="simulation-results">
      {/* SIMULATION : STICKY BAR */}
      <div
        className={cx(
          'osrd-simulation-sticky-bar',
          collapsedTimetable && 'with-collapsed-timetable'
        )}
      >
        <div className="row">
          <div className="col-xl-4">
            <TimeButtons />
          </div>
          <div className="col-xl-8 d-flex justify-content-end mt-2 mt-xl-0">
            <TrainDetails />
          </div>
        </div>
      </div>

      {/* SIMULATION : TIMELINE */}
      <TimeLine />

      {/* SIMULATION : SPACE TIME CHART */}
      <div className="osrd-simulation-container d-flex mb-2">
        <div className="spacetimechart-container" style={{ height: `${heightOfSpaceTimeChart}px` }}>
          {displaySimulation && (
            <SpaceTimeChartIsolated
              initialHeightOfSpaceTimeChart={heightOfSpaceTimeChart}
              onSetBaseHeightOfSpaceTimeChart={setHeightOfSpaceTimeChart}
              isDisplayed={isDisplayed}
            />
          )}
        </div>
      </div>

      {/* TRAIN : SPACE SPEED CHART */}
      <div className="osrd-simulation-container d-flex mb-2">
        <div
          className="speedspacechart-container"
          style={{ height: `${heightOfSpeedSpaceChart}px` }}
        >
          {displaySimulation && (
            <SpeedSpaceChart
              initialHeight={heightOfSpeedSpaceChart}
              onSetChartBaseHeight={setHeightOfSpeedSpaceChart}
            />
          )}
        </div>
      </div>

      {/* TRAIN : CURVES & SLOPES */}
      <div className="osrd-simulation-container d-flex mb-2">
        <div
          className="spacecurvesslopes-container"
          style={{ height: `${heightOfSpaceCurvesSlopesChart}px` }}
        >
          {displaySimulation && (
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
              onResizeStop={() => {
                dispatch(updateMustRedraw(true));
              }}
            >
              <SpaceCurvesSlopes heightOfSpaceCurvesSlopesChart={heightOfSpaceCurvesSlopesChart} />
            </Rnd>
          )}
        </div>
      </div>

      {/* TRAIN : PATH INFORMATION */}

      {simulation.trains[selectedTrain] && (
        <div className="osrd-simulation-container mb-2">
          <ChartManager selectedTrain={simulation.trains[selectedTrain]}>
            <LinearChart />
          </ChartManager>
        </div>
      )}

      {/* TRAIN : DRIVER TRAIN SCHEDULE */}
      {simulation.trains[selectedTrain] && (
        <div className="osrd-simulation-container mb-2">
          <DriverTrainSchedule train={simulation.trains[selectedTrain]} />
        </div>
      )}

      {displayAllowances ? (
        <div className="mb-2">
          <Allowances toggleAllowancesDisplay={toggleAllowancesDisplay} />
        </div>
      ) : (
        <div
          role="button"
          tabIndex={-1}
          className="btn osrd-config-item-container d-flex align-items-center mb-2 font-weight-bold"
          onClick={toggleAllowancesDisplay}
        >
          {t('simulation:allowances')}
          <i className="icons-arrow-down ml-auto" />
        </div>
      )}

      {/* SIMULATION : MAP */}
      <div className="row" ref={timeTableRef}>
        <div className="col-12">
          <div className="osrd-simulation-container mb-2">
            <div className="osrd-simulation-map" style={{ height: `${heightOfSimulationMap}px` }}>
              {/* <Rnd
                    className="map-resizer"
                    default={{
                      x: 0,
                      y: 0,
                      height: `${heightOfSimulationMap}px`,
                      width: 'auto',
                    }}
                    minHeight={MAP_MIN_HEIGHT}
                    maxHeight={mapMaxHeight}
                    style={{
                      paddingBottom: '12px',
                    }}
                    disableDragging
                    enableResizing={{
                      bottom: true,
                    }}
                    onResizeStart={() => setinitialHeightOfSimulationMap(heightOfSimulationMap)}
                    onResize={(_e, _dir, _refToElement, delta) => {
                      setHeightOfSimulationMap(initialHeightOfSimulationMap + delta.height);
                    }}
                    onResizeStop={() => {
                      dispatch(updateMustRedraw(true));
                    }}
                  >
                    <Map setExtViewport={setExtViewport} />
                  </Rnd> */}
              <SimulationResultsMap setExtViewport={setExtViewport} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
