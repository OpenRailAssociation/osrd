import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { get } from 'common/requests';
import { FlyToInterpolator } from 'react-map-gl';
import ButtonFullscreen from 'common/ButtonFullscreen';
import CenterLoader from 'common/CenterLoader/CenterLoader';
import SpaceTimeChart from 'applications/osrd/views/OSRDSimulation/SpaceTimeChart';
import SpeedSpaceChart from 'applications/osrd/views/OSRDSimulation/SpeedSpaceChart';
import TimeTable from 'applications/osrd/views/OSRDSimulation/TimeTable';
import Map from 'applications/osrd/views/OSRDSimulation/Map';
import TrainDetails from 'applications/osrd/views/OSRDSimulation/TrainDetails';
import TrainsList from 'applications/osrd/views/OSRDSimulation/TrainsList';
import TimeButtons from 'applications/osrd/views/OSRDSimulation/TimeButtons';
import TimeLine from 'applications/osrd/components/TimeLine/TimeLine';
import { updateViewport } from 'reducers/map';
import { updateTimePosition, updateSimulation } from 'reducers/osrdsimulation';
import { simplifyData } from 'applications/osrd/components/Helpers/ChartHelpers';
import './OSRDSimulation.scss';
import { sec2time } from 'utils/timeManipulation';

const timetableURI = '/osrd/timetable';
const trainscheduleURI = '/osrd/train_schedule';

const SIMPLIFICATION_FACTOR = 10; // Division of steps

const OSRDSimulation = () => {
  const { t } = useTranslation(['translation', 'simulation']);
  const { fullscreen, darkmode } = useSelector((state) => state.main);
  const [extViewport, setExtViewport] = useState(undefined);
  const [waitingMessage, setWaitingMessage] = useState(t('simulation:waiting'));
  const [isEmpty, setIsEmpty] = useState(true);
  const [spaceTimeFullWidth, setSpaceTimeFullWidth] = useState(true);
  const { timetableID } = useSelector((state) => state.osrdconf);
  const {
    hoverPosition, selectedTrain, simulation,
  } = useSelector((state) => state.osrdsimulation);
  const dispatch = useDispatch();

  if (darkmode) {
    import('./OSRDSimulationDarkMode.scss');
  }

  const WaitingLoader = () => {
    if (isEmpty) {
      return <h1 className="text-center">{t('simulation:noData')}</h1>;
    }
    return <CenterLoader message={waitingMessage} />;
  };

  const getTimetable = async (timetableID) => {
    try {
      const simulationLocal = [];
      const timetable = await get(`${timetableURI}/${timetableID}`);
      if (timetable.train_schedules.length > 0) { setIsEmpty(false); }
      for (const [idx, trainschedule] of timetable.train_schedules.entries()) {
        try {
          const trainResult = await get(`${trainscheduleURI}/${trainschedule.id}/result/`);
          const trainDetails = await get(`${trainscheduleURI}/${trainschedule.id}`);
          await setWaitingMessage(`${t('simulation:loadingTrain')} ${idx + 1}/${timetable.train_schedules.length}`);
          simulationLocal.push({ ...trainResult, labels: trainDetails.labels});
        } catch (e) {
          console.log('ERROR', e);
        }
      }
      setWaitingMessage(t('simulation:simplify'));
      simulationLocal.sort((a, b) => a.stops[0].time > b.stops[0].time);
      dispatch(updateSimulation({ trains: simplifyData(simulationLocal, SIMPLIFICATION_FACTOR) }));
    } catch (e) {
      console.log('ERROR', e);
    }
  };

  useEffect(() => {
    if (simulation.trains[selectedTrain]
      && simulation.trains[selectedTrain].steps[hoverPosition]) {
      dispatch(
        updateTimePosition(
          sec2time(simulation.trains[selectedTrain].steps[hoverPosition].time),
        ),
      );
    }
  }, [hoverPosition, selectedTrain]);

  useEffect(() => {
    getTimetable(timetableID);
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
              <div className="osrd-simulation-container mb-2">
                <div className="row">
                  {spaceTimeFullWidth ? (
                    <div className="col-1">
                      {simulation.trains[selectedTrain].name}
                    </div>
                  ) : (
                    <div className="col-md-6">
                      <TrainsList />
                    </div>
                  )}
                  <div className={spaceTimeFullWidth ? 'col-11' : 'col-md-6'}>
                    {simulation.trains.length > 0 ? (
                      <SpaceTimeChart />
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="mb-2">
                <TimeLine />
              </div>
              <div className="osrd-simulation-container mb-2">
                <div className="row">
                  <div className="col-md-4">
                    <TimeButtons />
                  </div>
                  <div className="col-md-8">
                    {simulation.trains.length > 0 ? (
                      <TrainDetails />
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="mb-2">
                {simulation.trains.length > 0 ? (
                  <SpeedSpaceChart />
                ) : null}
              </div>
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
