import React, { useState } from 'react';
import SpaceTimeChart from 'applications/operationalStudies/components/SimulationResults/SpaceTimeChart/withOSRDData';
import SpeedSpaceChart from 'applications/operationalStudies/components/SimulationResults/SpeedSpaceChart/withOSRDData';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { getPresentSimulation } from 'reducers/osrdsimulation/selectors';
import { AllowancesSettings } from 'reducers/osrdsimulation/types';
import { SimulationReport } from 'common/api/osrdEditoastApi';

const OSRDStcdmResults = () => {
  const { t } = useTranslation(['translation', 'operationalStudies/manageTrainSchedule']);
  const [showSpeedSpaceChart, setShowSpeedSpaceChart] = useState(false);

  const [spaceTimeChartHeight, setSpaceTimeChartHeight] = useState(450);
  const [speedSpaceChartHeight, setSpeedSpaceChartHeight] = useState(450);

  const simulation = useSelector(getPresentSimulation);
  // by default, we show the ecoblocks for stdcm (if existing)
  const allowancesSettings = (simulation.trains as SimulationReport[]).reduce((acc, train) => {
    acc[train.id] = train.eco?.route_aspects
      ? {
          base: true,
          baseBlocks: false,
          eco: true,
          ecoBlocks: true,
        }
      : {
          base: true,
          baseBlocks: true,
          eco: false,
          ecoBlocks: false,
        };
    return acc;
  }, {} as AllowancesSettings);

  return (
    <main className="osrd-config-mastcontainer" style={{ height: '115vh' }}>
      <div className="osrd-simulation-container mb-2 simulation-results">
        <div className="osrd-config-item mb-2">
          <div className="osrd-simulation-container mb-2">
            <p className="mt-2 mb-3 ml-4 font-weight-bold">
              {t('operationalStudies/manageTrainSchedule:spaceTimeGraphic')}
            </p>
            <div
              className="spacetimechart-container mt-2"
              style={{ height: `${spaceTimeChartHeight}px` }}
            >
              <SpaceTimeChart
                allowancesSettings={allowancesSettings}
                initialHeightOfSpaceTimeChart={450}
                onSetBaseHeightOfSpaceTimeChart={setSpaceTimeChartHeight}
              />
            </div>
          </div>
          <div className="osrd-config-item-container">
            <div
              role="button"
              tabIndex={-1}
              className="btn d-flex align-items-center mb-1 font-weight-bold"
              onClick={() => setShowSpeedSpaceChart(!showSpeedSpaceChart)}
            >
              {t('operationalStudies/manageTrainSchedule:spaceSpeedGraphic')}
              <i
                className={
                  showSpeedSpaceChart ? 'icons-arrow-up ml-auto' : 'icons-arrow-down ml-auto'
                }
              />
            </div>
            {showSpeedSpaceChart && (
              <div
                className="speedspacechart-container"
                style={{ height: `${speedSpaceChartHeight}px`, marginBottom: '50px' }}
              >
                <SpeedSpaceChart
                  initialHeight={450}
                  onSetChartBaseHeight={setSpeedSpaceChartHeight}
                  showSettings={false}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

export default OSRDStcdmResults;
