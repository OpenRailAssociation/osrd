import 'applications/osrd/views/OSRDSimulation/OSRDSimulation.scss';
import 'applications/osrd/views/OSRDConfig/OSRDConfig.scss';

import {
  KEY_VALUES_FOR_CONSOLIDATED_SIMULATION,
  timetableURI,
  trainscheduleURI,
} from 'applications/osrd/views/OSRDSimulation/OSRDSimulation';
import React, { useEffect, useState } from 'react';
import {
  updateAllowancesSettings,
  updateConsolidatedSimulation,
  updateMustRedraw,
  updateSelectedProjection,
  updateSelectedTrain,
  updateSimulation,
} from 'reducers/osrdsimulation';
import { useDispatch, useSelector } from 'react-redux';

import SpaceTimeChart from 'applications/osrd/views/OSRDSimulation/SpaceTimeChart';
import SpeedSpaceChart from 'applications/osrd/views/OSRDSimulation/SpeedSpaceChart';
import TimeTable from 'applications/osrd/views/OSRDSimulation/TimeTable';
import createTrain from 'applications/osrd/components/Simulation/SpaceTimeChart/createTrain';
import { get } from 'common/requests';
import { setFailure } from 'reducers/main.ts';
import { stdcmRequestStatus } from 'applications/stdcm/views/OSRDSTDCM';
import { useTranslation } from 'react-i18next';

export default function OSRDStcdmResults(props) {
  const { selectedTrain } = useSelector((state) => state.osrdsimulation);
  const simulation = useSelector((state) => state.osrdsimulation.simulation.present);
  const { timetableID } = useSelector((state) => state.osrdconf);
  const { t } = useTranslation(['translation', 'osrdconf']);
  const [isEmpty, setIsEmpty] = useState(true);
  const { currentStdcmRequestStatus } = props;
  const { allowancesSettings, selectedProjection } = useSelector((state) => state.osrdsimulation);
  const dispatch = useDispatch();

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

    getTimetable();
    return function cleanup() {
      // window.removeEventListener('keydown', handleKey);
      dispatch(updateSelectedProjection(undefined));
      dispatch(updateSimulation({ trains: [] }));
    };
  }, []);

  let stdcmResultsSection;
  if (
    currentStdcmRequestStatus === stdcmRequestStatus.success &&
    simulation.trains[selectedTrain] !== undefined
  ) {
    stdcmResultsSection = (
      <main className="osrd-config-mastcontainer mastcontainer">
        <div className="row m-0 px-1 py-3">
          <div className="col-sm-12">
            <div className="osrd-config-item-container ">
              <h1 className=" text-center text-info">
                <b>{t('osrdconf:stdcmResults')}</b>
              </h1>
              <div className="osrd-config-item mb-2">
                <h2>{t('osrdconf:spaceSpeedGraphic')}</h2>
                <div className="speedspacechart-container" style={{ height: '250px' }}>
                  <SpeedSpaceChart heightOfSpeedSpaceChart={250} showSettings={false} />
                </div>
                <div className="speedspacechart-container" style={{ height: '250px' }}>
                  <SpaceTimeChart heightOfSpaceTimeChart={250} />
                </div>
              </div>
              <div className="osrd-config-item">
                <div className="col-sm-12">
                  <TimeTable />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  } else if (currentStdcmRequestStatus === stdcmRequestStatus.noresults) {
    stdcmResultsSection = (
      <main className="osrd-config-mastcontainer mastcontainer">
        <div className="row m-0 px-1 py-3">
          <div className="col-sm-12">
            <div className="osrd-config-item-container">
              <h1 className="text-center text-info">{t('osrdconf:stdcmResults')}</h1>
              <p>{t('osrdconf:stdcmNoResults')}</p>
            </div>
          </div>
        </div>
      </main>
    );
  } else
    stdcmResultsSection = (
      <main className="osrd-config-mastcontainer mastcontainer">
        <div className="row m-0 px-1 py-3">
          <div className="col-sm-12">
            <div className="osrd-config-item-container ">
              <h1 className=" text-center text-info">
                <b>{t('osrdconf:stdcmResults')}</b>
              </h1>
              <div className="osrd-config-item mb-2">
                <h2>{t('osrdconf:spaceSpeedGraphic')}</h2>
                <div className="speedspacechart-container" style={{ height: '250px' }}>
                  {simulation.trains.length > 0 && <SpaceTimeChart heightOfSpaceTimeChart={250} />}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );

  return stdcmResultsSection;
}
