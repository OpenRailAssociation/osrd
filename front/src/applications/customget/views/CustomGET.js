import './CustomGET.scss';

import React, { useEffect, useState } from 'react';
import {
  persistentRedoSimulation,
  persistentUndoSimulation,
} from 'reducers/osrdsimulation/simulation';
import {
  updateConsolidatedSimulation,
  updateMustRedraw,
  updateSelectedProjection,
  updateSelectedTrain,
  updateSimulation,
} from 'reducers/osrdsimulation';
import { useDispatch, useSelector } from 'react-redux';

import CenterLoader from 'common/CenterLoader/CenterLoader';
import { Rnd } from 'react-rnd';
import SpaceTimeChart from 'applications/customget/views/SpaceTimeChart';
import TimeTable from 'applications/customget/views/TimeTable';
import TrainList from 'applications/customget/views/TrainList';
import createTrain from 'applications/customget/components/SpaceTimeChart/createTrain';
import { get } from 'common/requests.ts';
import { sec2time } from 'utils/timeManipulation';
import { setFailure } from 'reducers/main.ts';
import { useTranslation } from 'react-i18next';

// To remove
import staticData from 'applications/customget/static-data-simulation.json';

export const KEY_VALUES_FOR_CONSOLIDATED_SIMULATION = ['time', 'position'];
export const timetableURI = '/timetable/';

export const trainscheduleURI = '/train_schedule/';

function CustomGET() {
  const { t } = useTranslation(['translation', 'simulation', 'allowances']);
  const { fullscreen, darkmode } = useSelector((state) => state.main);
  const [isEmpty, setIsEmpty] = useState(true);
  const [displayTrainList, setDisplayTrainList] = useState(false);

  const [heightOfSpaceTimeChart, setHeightOfSpaceTimeChart] = useState(400);
  const [initialHeightOfSpaceTimeChart, setInitialHeightOfSpaceTimeChart] =
    useState(heightOfSpaceTimeChart);

  const { timetableID } = useSelector((state) => state.osrdconf);
  const { selectedProjection, departureArrivalTimes, selectedTrain } = useSelector(
    (state) => state.osrdsimulation
  );
  const simulation = useSelector((state) => state.osrdsimulation.simulation.present);
  const dispatch = useDispatch();

  if (darkmode) {
    import('./CustomGETDarkMode.scss');
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
            </div>
          </div>

          <div className="row">
            <div className="col-md-6">
              <div className="osrd-simulation-container mb-2">
                {simulation.trains.length > 0 ? <TimeTable /> : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default CustomGET;
