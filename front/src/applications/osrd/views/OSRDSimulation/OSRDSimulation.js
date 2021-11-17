import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { get } from 'common/requests';
import { setFailure } from 'reducers/main.ts';
import { FlyToInterpolator } from 'react-map-gl';
import ButtonFullscreen from 'common/ButtonFullscreen';
import CenterLoader from 'common/CenterLoader/CenterLoader';
import ContextMenu from 'applications/osrd/components/Simulation/ContextMenu';
import Margins from 'applications/osrd/views/OSRDSimulation/Margins';
import SpaceTimeChart from 'applications/osrd/views/OSRDSimulation/SpaceTimeChart';
import SpeedSpaceChart from 'applications/osrd/views/OSRDSimulation/SpeedSpaceChart';
import TimeTable from 'applications/osrd/views/OSRDSimulation/TimeTable';
import Map from 'applications/osrd/views/OSRDSimulation/Map';
import TrainDetails from 'applications/osrd/views/OSRDSimulation/TrainDetails';
import TrainList from 'applications/osrd/views/OSRDSimulation/TrainList';
import TimeButtons from 'applications/osrd/views/OSRDSimulation/TimeButtons';
import TimeLine from 'applications/osrd/components/TimeLine/TimeLine';
import { updateViewport } from 'reducers/map';
import {
  updateMarginsSettings, updateMustRedraw, updateSelectedTrain, updateSimulation, updateStickyBar,
} from 'reducers/osrdsimulation';
import './OSRDSimulation.scss';
import { sec2time } from 'utils/timeManipulation';

const timetableURI = '/timetable/';
const trainscheduleURI = '/train_schedule/';

const OSRDSimulation = () => {
  const { t } = useTranslation(['translation', 'simulation']);
  const { fullscreen, darkmode } = useSelector((state) => state.main);
  const [extViewport, setExtViewport] = useState(undefined);
  const [isEmpty, setIsEmpty] = useState(true);
  const [displayTrainList, setDisplayTrainList] = useState(false);
  const [displayMargins, setDisplayMargins] = useState(false);
  const { timetableID } = useSelector((state) => state.osrdconf);
  const {
    marginsSettings, selectedTrain, simulation, stickyBar,
  } = useSelector((state) => state.osrdsimulation);
  const dispatch = useDispatch();

  if (darkmode) {
    import('./OSRDSimulationDarkMode.scss');
  }

  const WaitingLoader = () => {
    if (isEmpty) {
      return <h1 className="text-center">{t('simulation:noData')}</h1>;
    }
    return <CenterLoader message={t('simulation:waiting')} />;
  };

  const getTimetable = async () => {
    try {
      dispatch(updateSelectedTrain(0));
      dispatch(updateSimulation({ trains: [] }));
      const timetable = await get(`${timetableURI}${timetableID}/`);
      if (timetable.train_schedules.length > 0) { setIsEmpty(false); }
      const trainSchedulesIDs = timetable.train_schedules.map((train) => train.id);
      try {
        const simulationLocal = await get(
          `${trainscheduleURI}results/`,
          { train_ids: trainSchedulesIDs.join(',') },
        );
        simulationLocal.sort((a, b) => a.base.stops[0].time > b.base.stops[0].time);
        dispatch(updateSimulation({ trains: simulationLocal }));
        // Create margins settings for each train if not set
        const newMarginsSettings = { ...marginsSettings };
        simulationLocal.forEach((train) => {
          if (!newMarginsSettings[train.id]) {
            newMarginsSettings[train.id] = {
              base: true,
              baseBlocks: false,
              margins: true,
              marginsBlocks: true,
              eco: true,
              ecoBlocks: false,
            };
          }
        });
        dispatch(updateMarginsSettings(newMarginsSettings));
      } catch (e) {
        dispatch(setFailure({
          name: t('simulation:errorMessages.unableToRetrieveTrainSchedule'),
          message: `${e.message} : ${e.response.data.detail}`,
        }));
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

  const toggleMarginsDisplay = () => {
    setDisplayMargins(!displayMargins);
  };

  useEffect(() => {
    getTimetable();
  }, []);

  useEffect(() => {
    if (extViewport !== undefined) {
      dispatch(updateViewport({
        ...extViewport,
        transitionDuration: 1000,
        transitionInterpolator: new FlyToInterpolator(),
      }));
    }
  }, [extViewport]);

  return (
    <>
      <main className={`mastcontainer ${fullscreen ? ' fullscreen' : ''}`}>
        {simulation.trains.length === 0
          ? <div className="pt-5 mt-5"><WaitingLoader /></div> : (
            <div className="m-0 p-3">
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
                  tabIndex="-1"
                  className="btn-selected-train d-flex align-items-center mb-2"
                  onClick={toggleTrainList}
                >
                  <div className="mr-2">
                    {t('simulation:train')}
                    <span className="ml-2">{simulation.trains[selectedTrain].name}</span>
                  </div>
                  <div className="small mr-1">
                    {sec2time(simulation.trains[selectedTrain].base.stops[0].time)}
                  </div>
                  <div className="small">
                    {sec2time(simulation.trains[selectedTrain]
                      .base.stops[simulation.trains[selectedTrain].base.stops.length - 1].time)}
                  </div>
                  <div className="ml-auto d-flex align-items-center">
                    {t('simulation:trainList')}
                    <i className="ml-2 icons-arrow-down" />
                  </div>
                </div>
              )}
              <div className="osrd-simulation-container d-flex mb-2">
                <div className="spacetimechart-container">
                  {simulation.trains.length > 0 ? (
                    <SpaceTimeChart />
                  ) : null}
                  <ContextMenu />
                </div>
              </div>
              {stickyBar ? (
                <div className="osrd-simulation-sticky-bar">
                  <div className="row">
                    <div className="col-lg-4">
                      <TimeButtons />
                    </div>
                    <div className="col-lg-8">
                      {simulation.trains.length > 0 ? (
                        <TrainDetails />
                      ) : null}
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
              <div className="mb-2">
                {simulation.trains.length > 0 ? (
                  <SpeedSpaceChart />
                ) : null}
              </div>
              {displayMargins ? (
                <div className="mb-2">
                  <Margins toggleMarginsDisplay={toggleMarginsDisplay} />
                </div>
              ) : (
                <div
                  role="button"
                  tabIndex="-1"
                  className="btn-selected-train d-flex align-items-center mb-2"
                  onClick={toggleMarginsDisplay}
                >
                  {t('simulation:margins')}
                  <i className="icons-arrow-down ml-auto" />
                </div>
              )}
              <div className="row">
                <div className="col-md-6">
                  <div className="osrd-simulation-container mb-2">
                    {simulation.trains.length > 0 ? (
                      <TimeTable />
                    ) : null}
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="osrd-simulation-container osrd-simulation-map mb-2">
                    <Map setExtViewport={setExtViewport} />
                  </div>
                </div>
              </div>
              <ButtonFullscreen />
            </div>
          )}
      </main>
    </>
  );
};

export default OSRDSimulation;
