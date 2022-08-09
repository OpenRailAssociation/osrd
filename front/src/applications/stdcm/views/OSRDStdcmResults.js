import 'applications/osrd/views/OSRDSimulation/OSRDSimulation.scss';
import 'applications/osrd/views/OSRDConfig/OSRDConfig.scss';

import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import SpeedSpaceChart from 'applications/osrd/views/OSRDSimulation/SpeedSpaceChart';
import TimeTable from 'applications/osrd/views/OSRDSimulation/TimeTable';
import { stdcmRequestStatus } from 'applications/stdcm/views/OSRDSTDCM';
import { useTranslation } from 'react-i18next';

export default function OSRDStcdmResults(props) {
  const {
    selectedTrain,
  } = useSelector((state) => state.osrdsimulation);
  const simulation = useSelector((state) => state.osrdsimulation.simulation.present);
  const { t } = useTranslation(['translation', 'osrdconf']);

  const { currentStdcmRequestStatus } = props;

  let stdcmResultsSection;
  if (currentStdcmRequestStatus === stdcmRequestStatus.success
    && simulation.trains[selectedTrain] !== undefined) {
    stdcmResultsSection = (
      <main className="osrd-config-mastcontainer mastcontainer">
        <div className="row m-0 px-1 py-3">

          <div className="osrd-config-item-container mb-2">
            <h2>{t('osrdconf:cancelRequest')}</h2>
            <div className="osrd-config-item">
              <div className="speedspacechart-container" style={{ height: '250px' }}>

                <SpeedSpaceChart heightOfSpeedSpaceChart={250} showSettings={false} />
              </div>
            </div>
            <div className="osrd-config-item">
              <div className="col-sm-12">
                <TimeTable />
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  } else if (currentStdcmRequestStatus === stdcmRequestStatus.noresults) {
    stdcmResultsSection = (
      <main className="osrd-config-mastcontainer mastcontainer">
        <div className="osrd-config-item-container mb-2">
          <h2>{t('osrdconf:noResults')}</h2>
        </div>
      </main>
    );
  } else stdcmResultsSection = <></>;

  return (
    <>{stdcmResultsSection}</>
  );
}
