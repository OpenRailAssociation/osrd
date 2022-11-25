import 'applications/osrd/views/OSRDSimulation/OSRDSimulation.scss';
import 'applications/osrd/views/OSRDConfig/OSRDConfig.scss';

import { KEY_VALUES_FOR_CONSOLIDATED_SIMULATION } from 'applications/osrd/components/Simulation/consts';

import React, { useEffect } from 'react';
import {
  updateConsolidatedSimulation,
  updateMustRedraw,
  updateSelectedProjection,
  updateSimulation,
} from 'reducers/osrdsimulation';
import { useDispatch, useSelector } from 'react-redux';

import SpaceTimeChart from 'applications/osrd/views/OSRDSimulation/SpaceTimeChart';
import SpeedSpaceChart from 'applications/osrd/components/Simulation/SpeedSpaceChart/withOSRDData';
import createTrain from 'applications/osrd/components/Simulation/SpaceTimeChart/createTrain';

import { STDCM_REQUEST_STATUS } from 'applications/osrd/consts';
import { useTranslation } from 'react-i18next';
import getStdcmTimetable from 'applications/stdcm/getStdcmTimetable';
import DriverTrainSchedule from 'applications/osrd/views/OSRDSimulation/DriverTrainSchedule';

export default function OSRDStcdmResults(props) {
  const { selectedTrain } = useSelector((state) => state.osrdsimulation);
  const simulation = useSelector((state) => state.osrdsimulation.simulation.present);
  const { timetableID } = useSelector((state) => state.osrdconf);
  const { t } = useTranslation(['translation', 'osrdconf']);
  const { currentStdcmRequestStatus } = props;
  const { allowancesSettings, selectedProjection } = useSelector((state) => state.osrdsimulation);
  const dispatch = useDispatch();

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
    dispatch(updateMustRedraw(true));
  }, [simulation]);

  useEffect(() => {
    // Setup the listener to undi /redo
    // window.addEventListener('keydown', handleKey);

    if (timetableID) {
      getStdcmTimetable(
        simulation,
        selectedTrain,
        dispatch,
        timetableID,
        allowancesSettings,
        selectedProjection,
        t
      );
    }
    return function cleanup() {
      // window.removeEventListener('keydown', handleKey);
      dispatch(updateSelectedProjection(undefined));
      dispatch(updateSimulation({ trains: [] }));
    };
  }, []);

  let stdcmResultsSection;
  if (
    currentStdcmRequestStatus === STDCM_REQUEST_STATUS.success &&
    simulation.trains[selectedTrain] !== undefined
  ) {
    stdcmResultsSection = (
      <main className="osrd-config-mastcontainer mastcontainer">
        <div className="osrd-simulation-container mb-2 mx-3">
          <h1 className="text-center text-info">
            <b>{t('osrdconf:stdcmResults')}</b>
          </h1>
          <div className="osrd-config-item mb-2">
            <h2>{t('osrdconf:spaceSpeedGraphic')}</h2>
            <div className="speedspacechart-container" style={{ height: '450px' }}>
              <SpeedSpaceChart heightOfSpeedSpaceChart={450} showSettings={false} />
            </div>
            <div className="speedspacechart-container" style={{ height: '450px' }}>
              <SpaceTimeChart heightOfSpaceTimeChart={450} />
            </div>
          </div>
        </div>
        <div className="osrd-simulation-container mx-3">
          <div className="col-sm-12">
            {simulation.trains[selectedTrain] && (
              <DriverTrainSchedule data={simulation.trains[selectedTrain]} isModal={false} />
            )}
          </div>
        </div>
      </main>
    );
  } else if (currentStdcmRequestStatus === STDCM_REQUEST_STATUS.noresults) {
    stdcmResultsSection = (
      <main className="osrd-config-mastcontainer mastcontainer">
        <div className="osrd-simulation-container">
          <h1 className="text-center text-info">{t('osrdconf:stdcmResults')}</h1>
          <p>{t('osrdconf:stdcmNoResults')}</p>
        </div>
      </main>
    );
  } else
    stdcmResultsSection = (
      <main className="osrd-config-mastcontainer mastcontainer">
        <div className="osrd-simulation-container mx-3">
          <h1 className="text-center text-info">
            <b>{t('osrdconf:stdcmResults')}</b>
          </h1>
          <div className="osrd-config-item mb-2">
            <h2>{t('osrdconf:spaceSpeedGraphic')}</h2>
            <div className="speedspacechart-container" style={{ height: '450px' }}>
              {simulation.trains.length > 0 && <SpaceTimeChart heightOfSpaceTimeChart={450} />}
            </div>
          </div>
        </div>
      </main>
    );

  return stdcmResultsSection;
}
