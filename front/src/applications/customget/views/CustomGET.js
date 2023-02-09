import './CustomGET.scss';
import React, { useEffect, useState } from 'react';
import {
  updateConsolidatedSimulation,
  updateMustRedraw,
  updateSelectedProjection,
  updateSelectedTrain,
  updateSimulation,
} from 'reducers/osrdsimulation/actions';
import { useDispatch, useSelector } from 'react-redux';

import { Rnd } from 'react-rnd';
import TimeTable from 'applications/customget/views/TimeTable';
import TrainList from 'applications/customget/views/TrainList';
import TimeButtons from 'applications/customget/views/TimeButtons';
import TrainDetails from 'applications/customget/views/TrainDetails';
import createTrain from 'applications/customget/components/SpaceTimeChart/createTrain';
import { useTranslation } from 'react-i18next';
import DeprecatedSpaceTimeChart from 'applications/customget/views/DeprecatedSpaceTimeChart';

export const KEY_VALUES_FOR_CONSOLIDATED_SIMULATION = ['time', 'position'];

export const trainscheduleURI = '/train_schedule/';

function CustomGET() {
  const { t } = useTranslation(['translation', 'simulation']);
  const { fullscreen } = useSelector((state) => state.main);

  const [heightOfSpaceTimeChart, setHeightOfSpaceTimeChart] = useState(400);
  const [initialHeightOfSpaceTimeChart, setInitialHeightOfSpaceTimeChart] =
    useState(heightOfSpaceTimeChart);

  const simulation = useSelector((state) => state.osrdsimulation.simulation.present);
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(updateSimulation({ trains: [] }));
    dispatch(updateSelectedTrain(0));
    return function cleanup() {
      dispatch(updateSelectedProjection(undefined));
      dispatch(updateSimulation({ trains: [] }));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulation]);

  return (
    <main className={`mastcontainer customget ${fullscreen ? ' fullscreen' : ''}`}>
      {!simulation || simulation.trains.length === 0 ? (
        <div className="pt-5 mt-5">
          <h1 className="text-center">{t('customget:noData')}</h1>
        </div>
      ) : (
        <div className="m-0 p-3">
          <div className="row">
            <div className="col-lg-5">
              <div className="osrd-simulation-container mb-2">
                <div className="flex-fill" style={{ maxHeight: '40vh', overflow: 'auto' }}>
                  <TrainList />
                </div>
              </div>
            </div>
            <div className="col-lg-7">
              <div className="osrd-simulation-container mb-2">
                {simulation.trains.length > 0 ? <TimeTable /> : null}
              </div>
            </div>
          </div>
          <div className="scenario-results">
            <div className="simulation-results">
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
                      <DeprecatedSpaceTimeChart heightOfSpaceTimeChart={heightOfSpaceTimeChart} />
                    </Rnd>
                  )}
                </div>
              </div>
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
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default CustomGET;
