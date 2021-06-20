import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { get } from 'common/requests';
import ButtonFullscreen from 'common/ButtonFullscreen';
import CenterLoader from 'common/CenterLoader/CenterLoader';
import SpaceTimeChart from 'applications/osrd/views/OSRDSimulation/SpaceTimeChart';
import SpeedSpaceChart from 'applications/osrd/views/OSRDSimulation/SpeedSpaceChart';
import TimeTable from 'applications/osrd/views/OSRDSimulation/TimeTable';
import TrainDetails from 'applications/osrd/views/OSRDSimulation/TrainDetails';
import TrainsList from 'applications/osrd/views/OSRDSimulation/TrainsList';
import { simplifyData, timeShiftTrain, timeShiftStops } from 'applications/osrd/components/Helpers/ChartHelpers';
import './OSRDSimulation.scss';

const timetableURI = '/osrd/timetable';
const trainscheduleURI = '/osrd/train_schedule';

const OSRDSimulation = () => {
  const { t } = useTranslation(['translation', 'simulation']);
  const { fullscreen } = useSelector((state) => state.main);
  const [hoverPosition, setHoverPosition] = useState(undefined);
  // const [hoverStop, setHoverStop] = useState(undefined);
  const [selectedTrain, setSelectedTrain] = useState(0);
  const [mustRedraw, setMustRedraw] = useState(true);
  const osrdconf = useSelector((state) => state.osrdconf);
  const [simulation, setSimulation] = useState({ trains: [] });

  const getTimetable = async (timetableID) => {
    try {
      const simulationLocal = [];
      const timetable = await get(`${timetableURI}/${timetableID}`);
      for (const trainscheduleID of timetable.train_schedules) {
        try {
          simulationLocal.push(await get(`${trainscheduleURI}/${trainscheduleID}/result/`));
        } catch (e) {
          console.log('ERROR', e);
        }
      }
      setSimulation({ trains: simulationLocal });
    } catch (e) {
      console.log('ERROR', e);
    }
  };

  useEffect(() => {
    getTimetable(osrdconf.timetableID);
  }, []);

  /* / Test data simulated
  // TO REMOVE IN PRODUCTION
  useEffect(() => {
    if (simulationRaw !== undefined) {
      const shiftValue = 2500;
      const simulationLocal = { ...simulationRaw, trains: simplifyData(simulationRaw.trains, 25) };
      for (let idx = 1; idx < 5; idx += 1) {
        simulationLocal.trains.push(
          {
            ...simulationLocal.trains[0],
            steps: timeShiftTrain(simulationLocal.trains[0].steps, idx * shiftValue),
            stops: timeShiftStops(simulationLocal.trains[0].stops, idx * shiftValue),
            name: `${simulationLocal.trains[0].name}${idx}`,
          },
        );
      }
      setSimulation(simulationLocal);
      isWorking = false;
    }
  }, []);

  useEffect(() => {
    if (simulation !== undefined
      && simulation.trains[selectedTrain].steps[hoverPosition] !== undefined) {
      // const hoverTime = simulation.trains[selectedTrain].steps[hoverPosition].time;
    }
  }, [hoverPosition]);
  */

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
          ? <div className="pt-5 mt-5"><CenterLoader /></div> : (
            <div className="m-0 p-3">
              <div className="osrd-simulation-container mb-2">
                <div className="row">
                  <div className="col-md-4">
                    <TrainsList
                      simulation={simulation}
                      selectedTrain={selectedTrain}
                      setSelectedTrain={setSelectedTrain}
                      setMustRedraw={setMustRedraw}
                    />
                  </div>
                  <div className="col-md-8">
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
              <div className="osrd-simulation-container mb-2">
                {simulation.trains.length > 0 ? (
                  <TimeTable
                    data={simulation.trains[selectedTrain].stops}
                  />
                ) : null}
              </div>
              <ButtonFullscreen />
            </div>
          )}
      </main>
    </>
  );
};

export default OSRDSimulation;
