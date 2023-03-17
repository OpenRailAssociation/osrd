import { KEY_VALUES_FOR_CONSOLIDATED_SIMULATION } from 'applications/operationalStudies/components/SimulationResults/simulationResultsConsts';

import React, { useEffect, useState } from 'react';
import { updateConsolidatedSimulation, updateMustRedraw } from 'reducers/osrdsimulation/actions';
import { useDispatch, useSelector } from 'react-redux';

import SpaceTimeChart from 'applications/operationalStudies/components/SimulationResults/SpaceTimeChart/withOSRDData';
import SpeedSpaceChart from 'applications/operationalStudies/components/SimulationResults/SpeedSpaceChart/withOSRDData';
import createTrain from 'applications/operationalStudies/components/SimulationResults/SpaceTimeChart/createTrain';

import { STDCM_REQUEST_STATUS } from 'applications/operationalStudies/consts';
import { useTranslation } from 'react-i18next';

export default function OSRDStcdmResults(props) {
  const selectedTrain = useSelector((state) => state.osrdsimulation.selectedTrain);
  const simulation = useSelector((state) => state.osrdsimulation.simulation.present);
  const { t } = useTranslation(['translation', 'operationalStudies/manageTrainSchedule']);
  const { currentStdcmRequestStatus } = props;
  const dispatch = useDispatch();

  const [spaceTimeChartHeight, setSpaceTimeChartHeight] = useState(450);
  const [speedSpaceTimeChartHeight, setSpeedSpaceTimeChartHeight] = useState(450);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulation]);

  if (
    currentStdcmRequestStatus === STDCM_REQUEST_STATUS.success &&
    simulation.trains[selectedTrain] !== undefined
  )
    return (
      <main className="osrd-config-mastcontainer" style={{ height: '115vh' }}>
        <div className="osrd-simulation-container mb-2 mx-3 simulation-results">
          <h1 className="text-center text-info">
            <b>{t('operationalStudies/manageTrainSchedule:stdcmResults')}</b>
          </h1>
          <div className="osrd-config-item mb-2">
            <h2>{t('operationalStudies/manageTrainSchedule:spaceSpeedGraphic')}</h2>
            <div
              className="speedspacechart-container"
              style={{ height: `${speedSpaceTimeChartHeight}px`, marginBottom: '50px' }}
            >
              <SpeedSpaceChart
                initialHeightOfSpeedSpaceChart={450}
                onSetBaseHeightOfSpeedSpaceChart={setSpeedSpaceTimeChartHeight}
              />
            </div>
            <div
              className="spacetimechart-container"
              style={{ height: `${spaceTimeChartHeight}px` }}
            >
              <SpaceTimeChart
                initialHeightOfSpaceTimeChart={450}
                onSetBaseHeightOfSpaceTimeChart={setSpaceTimeChartHeight}
              />
            </div>
          </div>
        </div>
      </main>
    );

  if (currentStdcmRequestStatus === STDCM_REQUEST_STATUS.noresults) {
    return (
      <main className="osrd-config-mastcontainer mastcontainer">
        <div className="osrd-simulation-container">
          <h1 className="text-center text-info">
            {t('operationalStudies/manageTrainSchedule:stdcmResults')}
          </h1>
          <p>{t('operationalStudies/manageTrainSchedule:stdcmNoResults')}</p>
        </div>
      </main>
    );
  }
  return (
    <main className="osrd-config-mastcontainer mastcontainer">
      <div className="osrd-simulation-container mx-3">
        <h1 className="text-center text-info">
          <b>{t('operationalStudies/manageTrainSchedule:stdcmResults')}</b>
        </h1>
        <div className="osrd-config-item mb-2">
          <h2>{t('operationalStudies/manageTrainSchedule:spaceSpeedGraphic')}</h2>
          <div
            className="speedspacechart-container"
            style={{ height: `${spaceTimeChartHeight}px` }}
          >
            {simulation.trains.length > 0 && (
              <SpaceTimeChart
                initialHeightOfSpaceTimeChart={450}
                onSetBaseHeightOfSpaceTimeChart={setSpaceTimeChartHeight}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
