import './OSRDSimulation.scss';

import React, { useEffect, useState } from 'react';
import {
  persistentRedoSimulation,
  persistentUndoSimulation,
} from 'reducers/osrdsimulation/simulation';
import {
  updateAllowancesSettings,
  updateConsolidatedSimulation,
  updateMarginsSettings,
  updateMustRedraw,
  updateSelectedProjection,
  updateSelectedTrain,
  updateSignalBase,
  updateSimulation,
  updateStickyBar,
} from 'reducers/osrdsimulation';
import { useDispatch, useSelector } from 'react-redux';

import Allowances from 'applications/osrd/views/OSRDSimulation/Allowances';
import ButtonFullscreen from 'common/ButtonFullscreen';
import CenterLoader from 'common/CenterLoader/CenterLoader';
import ContextMenu from 'applications/osrd/components/Simulation/ContextMenu';
import { FlyToInterpolator } from 'react-map-gl';
import Map from 'applications/osrd/views/OSRDSimulation/Map';
import OSRDSignalSwitch from 'applications/osrd/components/Simulation/SignalSwitch/withOSRDData';
import { Rnd } from 'react-rnd';
import SpaceCurvesSlopes from 'applications/osrd/views/OSRDSimulation/SpaceCurvesSlopes';
import SpaceTimeChart from 'applications/osrd/views/OSRDSimulation/SpaceTimeChart';
import SpeedSpaceChart from 'applications/osrd/views/OSRDSimulation/SpeedSpaceChart';
import TimeButtons from 'applications/osrd/views/OSRDSimulation/TimeButtons';
import TimeLine from 'applications/osrd/components/TimeLine/TimeLine';
import TimeTable from 'applications/osrd/views/OSRDSimulation/TimeTable';
import TrainDetails from 'applications/osrd/views/OSRDSimulation/TrainDetails';
import TrainList from 'applications/osrd/views/OSRDSimulation/TrainList';
import createTrain from 'applications/osrd/components/Simulation/SpaceTimeChart/createTrain';
import { get } from 'common/requests';
import { sec2time } from 'utils/timeManipulation';
import { setFailure } from 'reducers/main.ts';
import { updateMode } from 'reducers/osrdconf';
import { updateViewport } from 'reducers/map';
import { useTranslation } from 'react-i18next';
import { MODES } from '../../consts';

export const KEY_VALUES_FOR_CONSOLIDATED_SIMULATION = ['time', 'position'];
export const timetableURI = '/timetable/';

export const trainscheduleURI = '/train_schedule/';

function OSRDSimulation() {
  const { t } = useTranslation(['translation', 'simulation', 'allowances']);
  const { fullscreen, darkmode } = useSelector((state) => state.main);
  const [extViewport, setExtViewport] = useState(undefined);
  const [isEmpty, setIsEmpty] = useState(true);
  const [displayTrainList, setDisplayTrainList] = useState(false);
  const [displayAllowances, setDisplayAllowances] = useState(false);

  const [heightOfSpaceTimeChart, setHeightOfSpaceTimeChart] = useState(400);
  const [initialHeightOfSpaceTimeChart, setInitialHeightOfSpaceTimeChart] =
    useState(heightOfSpaceTimeChart);

  const [heightOfSpeedSpaceChart, setHeightOfSpeedSpaceChart] = useState(250);
  const [initialHeightOfSpeedSpaceChart, setInitialHeightOfSpeedSpaceChart] =
    useState(heightOfSpeedSpaceChart);

  const [heightOfSpaceCurvesSlopesChart, setHeightOfSpaceCurvesSlopesChart] = useState(150);
  const [initialHeightOfSpaceCurvesSlopesChart, setInitialHeightOfSpaceCurvesSlopesChart] =
    useState(heightOfSpaceCurvesSlopesChart);

  const { timetableID } = useSelector((state) => state.osrdconf);
  const {
    allowancesSettings,
    selectedProjection,
    departureArrivalTimes,
    selectedTrain,
    stickyBar,
    signalBase,
  } = useSelector((state) => state.osrdsimulation);
  const simulation = useSelector((state) => state.osrdsimulation.simulation.present);
  const dispatch = useDispatch();

  if (darkmode) {
    import('./OSRDSimulationDarkMode.scss');
  }

  function WaitingLoader() {
    if (isEmpty) {
      return <h1 className="text-center">{t('simulation:noData')}</h1>;
    }
    return <CenterLoader message={t('simulation:waiting')} />;
  }

  /**
   * Recover the time table for all the trains
   */
  const getTimetable = async () => {
    try {
      if (!simulation.trains || !simulation.trains[selectedTrain]) {
        dispatch(updateSelectedTrain(0));
      }
      const timetable = await get(`${timetableURI}${timetableID}/`);
      if (timetable.train_schedules.length > 0) {
        setIsEmpty(false);
      }
      const trainSchedulesIDs = timetable.train_schedules.map((train) => train.id);
      const tempSelectedProjection = await get(`${trainscheduleURI}${trainSchedulesIDs[0]}/`);
      if (!selectedProjection) {
        dispatch(updateSelectedProjection(tempSelectedProjection));
      }
      try {
        const simulationLocal = await get(`${trainscheduleURI}results/`, {
          train_ids: trainSchedulesIDs.join(','),
          path: tempSelectedProjection.path,
        });
        simulationLocal.sort((a, b) => a.base.stops[0].time > b.base.stops[0].time);
        dispatch(updateSimulation({ trains: simulationLocal }));

        // Create margins settings for each train if not set
        const newAllowancesSettings = { ...allowancesSettings };
        simulationLocal.forEach((train) => {
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
            message: `${e.message} `,
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

  const handleKey = (e) => {
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
          transitionDuration: 1000,
          transitionInterpolator: new FlyToInterpolator(),
        })
      );
    }
  }, [extViewport]);

  // With this hook we update and store
  // the consolidatedSimuation (simualtion stucture for the selected train)
  useEffect(() => {
    const consolidatedSimulation = createTrain(
      dispatch,
      KEY_VALUES_FOR_CONSOLIDATED_SIMULATION,
      simulation.trains,
      t
    );
    // Store it to allow time->position logic to be hosted by redux
    dispatch(updateConsolidatedSimulation(consolidatedSimulation));
  }, [simulation]);

  return (
    <main className={`mastcontainer ${fullscreen ? ' fullscreen' : ''}`}>
      {!simulation || simulation.trains.length === 0 ? (
        <div className="pt-5 mt-5">
          <WaitingLoader />
        </div>
      ) : (
        <div className="m-0 p-3">
          <div className="mb-2">
            <TimeLine />
          </div>
          <div className="mb-2 osrd-simulation-container">
            <div className="ml-auto d-flex align-items-left">
              <OSRDSignalSwitch />
            </div>
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
              tabIndex="-1"
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
              {simulation.trains.length > 0 && (
                <Rnd
                  default={{
                    x: 0,
                    y: 0,
                    width: '100%',
                    height: `${heightOfSpaceTimeChart}px`,
                  }}
                  disableDragging
                  enableResizing={{
                    top: false,
                    right: false,
                    bottom: true,
                    left: false,
                    topRight: false,
                    bottomRight: false,
                    bottomLeft: false,
                    topLeft: false,
                  }}
                  onResizeStart={() => setInitialHeightOfSpaceTimeChart(heightOfSpaceTimeChart)}
                  onResize={(e, dir, refToElement, delta) => {
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
              {simulation.trains.length > 0 && (
                <Rnd
                  default={{
                    x: 0,
                    y: 0,
                    width: '100%',
                    height: `${heightOfSpeedSpaceChart}px`,
                  }}
                  disableDragging
                  enableResizing={{
                    top: false,
                    right: false,
                    bottom: true,
                    left: false,
                    topRight: false,
                    bottomRight: false,
                    bottomLeft: false,
                    topLeft: false,
                  }}
                  onResizeStart={() => setInitialHeightOfSpeedSpaceChart(heightOfSpeedSpaceChart)}
                  onResize={(e, dir, refToElement, delta) => {
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
              {simulation.trains.length > 0 && (
                <Rnd
                  default={{
                    x: 0,
                    y: 0,
                    width: '100%',
                    height: `${heightOfSpaceCurvesSlopesChart}px`,
                  }}
                  disableDragging
                  enableResizing={{
                    top: false,
                    right: false,
                    bottom: true,
                    left: false,
                    topRight: false,
                    bottomRight: false,
                    bottomLeft: false,
                    topLeft: false,
                  }}
                  onResizeStart={() =>
                    setInitialHeightOfSpaceCurvesSlopesChart(heightOfSpaceCurvesSlopesChart)
                  }
                  onResize={(e, dir, refToElement, delta) => {
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
              tabIndex="-1"
              className="btn-selected-train d-flex align-items-center mb-2"
              onClick={toggleAllowancesDisplay}
            >
              {t('simulation:allowances')}
              <i className="icons-arrow-down ml-auto" />
            </div>
          )}
          <div className="row">
            <div className="col-md-6">
              <div className="osrd-simulation-container mb-2">
                {simulation.trains.length > 0 ? <TimeTable /> : null}
              </div>
            </div>
            <div className="col-md-6">
              <div className="osrd-simulation-container osrd-simulation-map mb-2">
                <Map setExtViewport={setExtViewport} />
              </div>
            </div>
          </div>
          {stickyBar ? (
            <div className="osrd-simulation-sticky-bar">
              <div className="row">
                <div className="col-lg-4">
                  <TimeButtons />
                </div>
                <div className="col-lg-8">
                  {simulation.trains.length > 0 ? <TrainDetails /> : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="osrd-simulation-sticky-bar-mini">
              <button
                className="btn btn-sm btn-only-icon btn-primary ml-auto mr-1"
                type="button"
                onClick={() => dispatch(updateStickyBar(true))}
              >
                <i className="icons-arrow-prev" />
              </button>
              <TimeButtons />
            </div>
          )}
          <ButtonFullscreen />
        </div>
      )}
    </main>
  );
}

export default OSRDSimulation;
