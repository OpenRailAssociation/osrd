import React, { useEffect, useState } from 'react';
import { store } from 'Store';
import { useSelector } from 'react-redux';
import { redirectToGraph } from 'reducers/osrdsimulation';
import { Redirect } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ButtonFullscreen from 'common/ButtonFullscreen';
import CenterLoader from 'common/CenterLoader/CenterLoader';
import SpaceTimeChart from 'applications/osrd/views/OSRDSimulation/SpaceTimeChart';
import SpeedSpaceChart from 'applications/osrd/views/OSRDSimulation/SpeedSpaceChart';
import TimeTable from 'applications/osrd/views/OSRDSimulation/TimeTable';
import { simplifyData, timeShiftTrain, timeShiftStops } from 'applications/osrd/components/Helpers/ChartHelpers';
import './OSRDSimulation.scss';

// For testdata
import testData from './test-data.json';

let isWorking = true;
const simulationRaw = testData;

const OSRDSimulation = () => {
  const { t } = useTranslation();
  const { fullscreen } = useSelector((state) => state.main);
  const [hoverPosition, setHoverPosition] = useState(undefined);
  const [selectedTrain, setSelectedTrain] = useState(0);
  // const { isWorking, simulationRaw } = useSelector((state) => state.osrdsimulation);
  const [simulation, setSimulation] = useState(undefined);

  // Test data simulated
  // TO REMOVE IN PRODUCTION
  useEffect(() => {
    if (simulationRaw !== undefined) {
      const shiftValue = 1500;
      const simulationLocal = { ...simulationRaw, trains: simplifyData(simulationRaw.trains, 25) };
      for (let idx = 1; idx < 2; idx += 1) {
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

  /* useEffect(() => {
    c
    if (!isWorking && simulation !== undefined && simulation.trains.length === 1) {
      for (let idx = 1; idx < 2; idx += 1) {
        simulation.trains.push(
          {
            ...simulation.trains[0],
            steps: timeShiftTrain(simulation.trains[0].steps, idx * shiftValue),
            stops: timeShiftStops(simulation.trains[0].stops, idx * shiftValue),
            name: `${simulation.trains[0].name}${idx}`,
          },
        );
      }
    }
  }, []); */

  store.dispatch(redirectToGraph(false));

  const play = () => {
    for (let i = 0; i < simulation.trains[0].steps.length; i += 10) {
      setTimeout(() => {
        setHoverPosition(i);
      }, 500);
    }
  };

  const offsetTimeByDragging = (offset) => {
    const { trains } = simulation;
    trains[selectedTrain] = {
      ...simulation.trains[selectedTrain],
      steps: timeShiftTrain(simulation.trains[selectedTrain].steps, offset),
      stops: timeShiftStops(simulation.trains[selectedTrain].stops, offset),
    };
    setSimulation({ ...simulation, trains });
  };

  return (
    <>
      {isWorking === false && simulation === undefined
        ? <Redirect to="/osrd/settings" /> : null}
      <main className={`mastcontainer ${fullscreen ? ' fullscreen' : ''}`}>
        {isWorking || simulation === undefined ? (
          <CenterLoader message={t('osrd.simulation.isWorking')} />
        ) : (
          <div className="m-0 p-3">
            <div className="osrd-simulation-container mb-2">
              <TimeTable data={simulation.trains[selectedTrain].stops} />
            </div>
            <div className="osrd-simulation-container mb-2">
              <button type="button" onClick={play} className="btn btn-secondary btn-sm">PLAY</button>
              <SpaceTimeChart
                simulation={simulation}
                hoverPosition={hoverPosition}
                setHoverPosition={setHoverPosition}
                selectedTrain={selectedTrain}
                setSelectedTrain={setSelectedTrain}
                offsetTimeByDragging={offsetTimeByDragging}
              />
            </div>
            <div className="osrd-simulation-container mb-2">
              <SpeedSpaceChart
                simulation={simulation}
                hoverPosition={hoverPosition}
                setHoverPosition={setHoverPosition}
                selectedTrain={selectedTrain}
                setSelectedTrain={setSelectedTrain}
              />
            </div>
            <ButtonFullscreen />
          </div>
        )}
      </main>
    </>
  );
};

export default OSRDSimulation;
