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
import { updateViewport } from 'reducers/map';
import { simplifyData, timeShiftTrain, timeShiftStops } from 'applications/osrd/components/Helpers/ChartHelpers';
import './OSRDSimulation.scss';

const timetableURI = '/osrd/timetable';
const trainscheduleURI = '/osrd/train_schedule';

const OSRDSimulation = () => {
  const { t } = useTranslation(['translation', 'simulation']);
  const { fullscreen } = useSelector((state) => state.main);
  const [hoverPosition, setHoverPosition] = useState(undefined);
  // const [hoverStop, setHoverStop] = useState(undefined);
  const [extViewport, setExtViewport] = useState(undefined);
  const [selectedTrain, setSelectedTrain] = useState(0);
  const [isEmpty, setIsEmpty] = useState(true);
  const [mustRedraw, setMustRedraw] = useState(true);
  const osrdconf = useSelector((state) => state.osrdconf);
  const [simulation, setSimulation] = useState({ trains: [] });
  const dispatch = useDispatch();

  const WaitingLoader = () => {
    if (isEmpty) {
      return <h1 className="text-center">{t('simulation:noData')}</h1>;
    }
    return <CenterLoader />;
  };

  const getTimetable = async (timetableID) => {
    try {
      const simulationLocal = [];
      const timetable = await get(`${timetableURI}/${timetableID}`);
      if (timetable.train_schedules.length > 0) { setIsEmpty(false); }
      for (const trainschedule of timetable.train_schedules) {
        try {
          const trainResult = await get(`${trainscheduleURI}/${trainschedule.id}/result/`)
          const trainDetails = await get(`${trainscheduleURI}/${trainschedule.id}`)
          simulationLocal.push({ ...trainResult, labels: trainDetails.labels});
        } catch (e) {
          console.log('ERROR', e);
        }
      }
      simulationLocal.sort((a, b) => a.stops[0].time > b.stops[0].time);
      setSimulation({ trains: simulationLocal });
    } catch (e) {
      console.log('ERROR', e);
    }
  };

  useEffect(() => {
    getTimetable(osrdconf.timetableID);
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

  const offsetTimeByDragging = (offset, selectedTrainLocal) => {
    const { trains } = simulation;
    trains[selectedTrainLocal] = {
      ...simulation.trains[selectedTrainLocal],
      steps: timeShiftTrain(simulation.trains[selectedTrainLocal].steps, offset),
      stops: timeShiftStops(simulation.trains[selectedTrainLocal].stops, offset),
    };
    setSimulation({ ...simulation, trains });
  };

  return (
    <>
      <main className={`mastcontainer ${fullscreen ? ' fullscreen' : ''}`}>
        {simulation.trains.length === 0
          ? <div className="pt-5 mt-5"><WaitingLoader /></div> : (
            <div className="m-0 p-3">
              <div className="osrd-simulation-container mb-2">
                <div className="row">
                  <div className="col-md-6">
                    <TrainsList
                      simulation={simulation}
                      selectedTrain={selectedTrain}
                      setSelectedTrain={setSelectedTrain}
                      setMustRedraw={setMustRedraw}
                    />
                  </div>
                  <div className="col-md-6">
                    {simulation.trains.length > 0 ? (
                      <SpaceTimeChart
                        simulation={simulation}
                        hoverPosition={hoverPosition}
                        setHoverPosition={setHoverPosition}
                        selectedTrain={selectedTrain}
                        setSelectedTrain={setSelectedTrain}
                        offsetTimeByDragging={offsetTimeByDragging}
                        mustRedraw={mustRedraw}
                        setMustRedraw={setMustRedraw}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="osrd-simulation-container mb-2">
                <div className="row">
                  <div className="col-md-4">
                    {simulation.trains.length > 0 ? (
                      <TrainDetails
                        simulation={simulation}
                        hoverPosition={hoverPosition}
                        selectedTrain={selectedTrain}
                      />
                    ) : null}
                  </div>
                  <div className="col-md-8">
                    {simulation.trains.length > 0 ? (
                      <SpeedSpaceChart
                        simulation={simulation}
                        hoverPosition={hoverPosition}
                        setHoverPosition={setHoverPosition}
                        selectedTrain={selectedTrain}
                        mustRedraw={mustRedraw}
                        setMustRedraw={setMustRedraw}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="row">
                <div className="col-md-6">
                  <div className="osrd-simulation-container mb-2">
                    {simulation.trains.length > 0 ? (
                      <TimeTable
                        data={simulation.trains[selectedTrain].stops}
                      />
                    ) : null}
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="osrd-simulation-container osrd-simulation-map mb-2">
                    <Map
                      hoverPosition={hoverPosition}
                      selectedTrain={selectedTrain}
                      simulation={simulation}
                      setExtViewport={setExtViewport}
                      setHoverPosition={setHoverPosition}
                    />
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
