import './OSRDSimulation.scss';

import React, { useEffect, useState, useRef } from 'react';
import {
  persistentRedoSimulation,
  persistentUndoSimulation,
} from 'reducers/osrdsimulation/simulation';
import {
  updateAllowancesSettings,
  updateMustRedraw,
  updateSelectedProjection,
  updateSelectedTrain,
  updateSimulation,
} from 'reducers/osrdsimulation/actions';
import { useDispatch, useSelector } from 'react-redux';

import Allowances from 'applications/operationalStudies/components/Simulation/Allowances/withOSRDData';

import CenterLoader from 'common/CenterLoader/CenterLoader';
import ContextMenu from 'applications/operationalStudies/components/Simulation/ContextMenu';
import Map from 'applications/operationalStudies/views/OSRDSimulation/Map';
import { Rnd } from 'react-rnd';
import SpaceCurvesSlopes from 'applications/operationalStudies/views/OSRDSimulation/SpaceCurvesSlopes';
import SpaceTimeChart from 'applications/operationalStudies/views/OSRDSimulation/SpaceTimeChart';
import SpeedSpaceChart from 'applications/operationalStudies/components/Simulation/SpeedSpaceChart/withOSRDData';
import TimeButtons from 'applications/operationalStudies/views/OSRDSimulation/TimeButtons';
import TimeLine from 'applications/operationalStudies/components/TimeLine/TimeLine';
import TrainDetails from 'applications/operationalStudies/views/OSRDSimulation/TrainDetails';
import TrainList from 'applications/operationalStudies/views/OSRDSimulation/TrainList';

import { trainscheduleURI } from 'applications/operationalStudies/components/Simulation/consts';
import { get } from 'common/requests';
import { sec2time } from 'utils/timeManipulation';
import { RootState } from 'reducers';
import { setFailure } from 'reducers/main';
import { updateViewport, Viewport } from 'reducers/map';
import { useTranslation } from 'react-i18next';

export const timetableURI = '/timetable/';
const CHART_MIN_HEIGHT = '150px';
const MAP_MIN_HEIGHT = 450;

function getMapMaxHeight(timeTableRef: React.MutableRefObject<HTMLDivElement | null>) {
  if (timeTableRef.current) {
    return timeTableRef.current.clientHeight - 42;
  }
  return 10000;
}

function OSRDSimulation() {
  const { t } = useTranslation(['translation', 'simulation', 'allowances']);
  const timeTableRef = useRef<HTMLDivElement | null>(null);
  const [extViewport, setExtViewport] = useState<Viewport | undefined>(undefined);
  const [isEmpty, setIsEmpty] = useState(true);
  const [displayTrainList, setDisplayTrainList] = useState(false);
  const [displayAllowances, setDisplayAllowances] = useState(false);

  const [heightOfSpaceTimeChart, setHeightOfSpaceTimeChart] = useState(400);
  const [initialHeightOfSpaceTimeChart, setInitialHeightOfSpaceTimeChart] =
    useState(heightOfSpaceTimeChart);

  const [heightOfSpeedSpaceChart, setHeightOfSpeedSpaceChart] = useState(250);
  const [initialHeightOfSpeedSpaceChart, setInitialHeightOfSpeedSpaceChart] =
    useState(heightOfSpeedSpaceChart);

  const [heightOfSimulationMap, setHeightOfSimulationMap] = useState(MAP_MIN_HEIGHT);
  const [initialHeightOfSimulationMap, setinitialHeightOfSimulationMap] =
    useState(heightOfSimulationMap);

  const [heightOfSpaceCurvesSlopesChart, setHeightOfSpaceCurvesSlopesChart] = useState(150);
  const [initialHeightOfSpaceCurvesSlopesChart, setInitialHeightOfSpaceCurvesSlopesChart] =
    useState(heightOfSpaceCurvesSlopesChart);

  const { timetableID } = useSelector((state: RootState) => state.osrdconf);

  const allowancesSettings = useSelector(
    (state: RootState) => state.osrdsimulation.allowancesSettings
  );
  const selectedProjection = useSelector(
    (state: RootState) => state.osrdsimulation.selectedProjection
  );
  const departureArrivalTimes = useSelector(
    (state: RootState) => state.osrdsimulation.departureArrivalTimes
  );
  const selectedTrain = useSelector((state: RootState) => state.osrdsimulation.selectedTrain);
  const displaySimulation = useSelector(
    (state: RootState) => state.osrdsimulation.displaySimulation
  );
  // const simulation = useSelector((state: RootState) => state.osrdsimulation.simulation.present);
  const dispatch = useDispatch();

  /**
   * Recover the time table for all the trains
   */
  const getTimetable = async () => {
    try {
      if (displaySimulation) {
        dispatch(updateSelectedTrain(0));
      }
      const timetable = await get(`${timetableURI}${timetableID}/`);
      if (timetable.train_schedules.length > 0) {
        setIsEmpty(false);
      }
      const trainSchedulesIDs = timetable.train_schedules.map((train: any) => train.id);
      const tempSelectedProjection = await get(`${trainscheduleURI}${trainSchedulesIDs[0]}/`);
      if (!selectedProjection) {
        dispatch(updateSelectedProjection(tempSelectedProjection));
      }
      try {
        const simulationLocal = await get(`${trainscheduleURI}results/`, {
          train_ids: trainSchedulesIDs.join(','),
          path: tempSelectedProjection.path,
        });
        simulationLocal.sort((a: any, b: any) => a.base.stops[0].time > b.base.stops[0].time);
        dispatch(updateSimulation({ trains: simulationLocal }));

        // Create margins settings for each train if not set
        const newAllowancesSettings = { ...allowancesSettings };
        simulationLocal.forEach((train: any) => {
          if (!newAllowancesSettings[train.id]) {
            newAllowancesSettings[train.id] = {
              base: true,
              baseBlocks: true,
              eco: true,
              ecoBlocks: false,
            };
          }
        });
        dispatch(updateAllowancesSettings(newAllowancesSettings));
      } catch (e) {
        dispatch(
          setFailure({
            name: t('simulation:errorMessages.unableToRetrieveTrainSchedule'),
            message: `${(e as Error).message} `,
          })
        );
        console.log('ERROR', e);
      }
    } catch (e) {
      console.log('ERROR', e);
    }
  };

  const toggleTrainList = () => {
    setDisplayTrainList(!displayTrainList);
    setTimeout(() => dispatch(updateMustRedraw(true)), 200);
  };

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

    getTimetable();
    return function cleanup() {
      window.removeEventListener('keydown', handleKey);
      dispatch(updateSelectedProjection(undefined));
      dispatch(updateSimulation({ trains: [] }));
    };
  }, []);

  useEffect(() => {
    getTimetable();
    return function cleanup() {
      dispatch(updateSimulation({ trains: [] }));
    };
  }, [selectedProjection]);

  useEffect(() => {
    if (extViewport !== undefined) {
      dispatch(
        updateViewport({
          ...extViewport,
        })
      );
    }
  }, [extViewport]);

  const waitingLoader = isEmpty ? (
    <h1 className="text-center">{t('simulation:noData')}</h1>
  ) : (
    <CenterLoader message={t('simulation:waiting')} />
  );

  const mapMaxHeight = getMapMaxHeight(timeTableRef);
  return (
    <>
      {!displaySimulation ? (
        <div className="pt-5 mt-5">{waitingLoader}</div>
      ) : (
        <div className="simulation-results">
          <div className="mb-2">
            <TimeLine />
          </div>
          {displayTrainList ? (
            <div className="osrd-simulation-container mb-2">
              <div className="flex-fill">
                <TrainList toggleTrainList={toggleTrainList} />
              </div>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={-1}
              className="btn-selected-train d-flex align-items-center mb-2"
              onClick={toggleTrainList}
            >
              <div className="mr-2">
                {t('simulation:train')}
                <span className="ml-2">{departureArrivalTimes[selectedTrain].name}</span>
              </div>
              <div className="small mr-1">
                {sec2time(departureArrivalTimes[selectedTrain].departure)}
              </div>
              <div className="small">{sec2time(departureArrivalTimes[selectedTrain].arrival)}</div>
              <div className="ml-auto d-flex align-items-center">
                {t('simulation:trainList')}
                <i className="ml-2 icons-arrow-down" />
              </div>
            </div>
          )}
          <div className="osrd-simulation-container d-flex mb-2">
            <div
              className="spacetimechart-container"
              style={{ height: `${heightOfSpaceTimeChart}px` }}
            >
              {displaySimulation && (
                <Rnd
                  default={{
                    x: 0,
                    y: 0,
                    width: '100%',
                    height: `${heightOfSpaceTimeChart}px`,
                  }}
                  minHeight={CHART_MIN_HEIGHT}
                  disableDragging
                  enableResizing={{
                    bottom: true,
                  }}
                  onResizeStart={() => setInitialHeightOfSpaceTimeChart(heightOfSpaceTimeChart)}
                  onResize={(_e, _dir, _refToElement, delta) => {
                    setHeightOfSpaceTimeChart(initialHeightOfSpaceTimeChart + delta.height);
                  }}
                  onResizeStop={() => {
                    dispatch(updateMustRedraw(true));
                  }}
                >
                  <SpaceTimeChart heightOfSpaceTimeChart={heightOfSpaceTimeChart} />
                </Rnd>
              )}
              <ContextMenu getTimetable={getTimetable} />
            </div>
          </div>
          <div className="osrd-simulation-container d-flex mb-2">
            <div
              className="speedspacechart-container"
              style={{ height: `${heightOfSpeedSpaceChart}px` }}
            >
              {displaySimulation && (
                <Rnd
                  default={{
                    x: 0,
                    y: 0,
                    width: '100%',
                    height: `${heightOfSpeedSpaceChart}px`,
                  }}
                  minHeight={CHART_MIN_HEIGHT}
                  disableDragging
                  enableResizing={{
                    bottom: true,
                  }}
                  onResizeStart={() => setInitialHeightOfSpeedSpaceChart(heightOfSpeedSpaceChart)}
                  onResize={(_e, _dir, _refToElement, delta) => {
                    setHeightOfSpeedSpaceChart(initialHeightOfSpeedSpaceChart + delta.height);
                  }}
                  onResizeStop={() => {
                    dispatch(updateMustRedraw(true));
                  }}
                >
                  <SpeedSpaceChart heightOfSpeedSpaceChart={heightOfSpeedSpaceChart} />
                </Rnd>
              )}
            </div>
          </div>
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
                  <SpaceCurvesSlopes
                    heightOfSpaceCurvesSlopesChart={heightOfSpaceCurvesSlopesChart}
                  />
                </Rnd>
              )}
            </div>
          </div>

          {displayAllowances ? (
            <div className="mb-2">
              <Allowances toggleAllowancesDisplay={toggleAllowancesDisplay} />
            </div>
          ) : (
            <div
              role="button"
              tabIndex={-1}
              className="btn-selected-train d-flex align-items-center mb-2"
              onClick={toggleAllowancesDisplay}
            >
              {t('simulation:allowances')}
              <i className="icons-arrow-down ml-auto" />
            </div>
          )}
          <div className="row" ref={timeTableRef}>
            <div className="col-12">
              <div className="osrd-simulation-container mb-2">
                <div
                  className="osrd-simulation-map"
                  style={{ height: `${heightOfSimulationMap}px` }}
                >
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
                  <Map setExtViewport={setExtViewport} />
                </div>
              </div>
            </div>
          </div>
          <div className="osrd-simulation-sticky-bar">
            <div className="row">
              <div className="col-lg-4">
                <TimeButtons />
              </div>
              <div className="col-lg-8">{displaySimulation ? <TrainDetails /> : null}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default OSRDSimulation;
