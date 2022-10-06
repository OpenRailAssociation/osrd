import './CustomGET.scss';

import React, { useEffect, useState } from 'react';
import {
  updateConsolidatedSimulation,
  updateMustRedraw,
  updateSelectedProjection,
  updateSelectedTrain,
  updateSimulation,
  updateStickyBar,
} from 'reducers/osrdsimulation';
import { useDispatch, useSelector } from 'react-redux';

import CenterLoader from 'common/CenterLoader/CenterLoader';
import { Rnd } from 'react-rnd';
import SpaceTimeChart from 'applications/customget/views/SpaceTimeChart';
import TimeTable from 'applications/customget/views/TimeTable';
import TrainList from 'applications/customget/views/TrainList';
import TimeButtons from 'applications/customget/views/TimeButtons';
import TrainDetails from 'applications/customget/views/TrainDetails';
import createTrain from 'applications/customget/components/SpaceTimeChart/createTrain';
import convertData from 'applications/customget/components/convertData';
import { get } from 'common/requests.ts';
import { sec2time } from 'utils/timeManipulation';
import { setFailure } from 'reducers/main.ts';
import { useTranslation } from 'react-i18next';

// To remove
import staticData from 'applications/customget/static-data-simulation.json';

export const KEY_VALUES_FOR_CONSOLIDATED_SIMULATION = ['time', 'position'];

export const trainscheduleURI = '/train_schedule/';

function CustomGET() {
  const { t } = useTranslation(['translation', 'simulation', 'allowances']);
  const { fullscreen, darkmode } = useSelector((state) => state.main);
  const [isEmpty, setIsEmpty] = useState(true);
  const [displayTrainList, setDisplayTrainList] = useState(false);

  const [heightOfSpaceTimeChart, setHeightOfSpaceTimeChart] = useState(400);
  const [initialHeightOfSpaceTimeChart, setInitialHeightOfSpaceTimeChart] =
    useState(heightOfSpaceTimeChart);

  const { departureArrivalTimes, selectedTrain, stickyBar } = useSelector(
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

  const toggleTrainList = () => {
    setDisplayTrainList(!displayTrainList);
    setTimeout(() => dispatch(updateMustRedraw(true)), 200);
  };

  useEffect(() => {
    dispatch(updateSimulation({ trains: convertData(staticData) }));
    dispatch(updateSelectedTrain(0));
    return function cleanup() {
      dispatch(updateSelectedProjection(undefined));
      dispatch(updateSimulation({ trains: [] }));
    };
  }, []);

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
      {stickyBar ? (
        <div className="osrd-simulation-sticky-bar">
          <div className="row">
            <div className="col-lg-4">
              <TimeButtons />
            </div>
            <div className="col-lg-8">{simulation.trains.length > 0 ? <TrainDetails /> : null}</div>
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
    </main>
  );
}

export default CustomGET;
