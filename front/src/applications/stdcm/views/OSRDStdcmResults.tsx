import React, { useMemo, useState } from 'react';
import SpeedSpaceChart from 'modules/simulationResult/components/SpeedSpaceChart/SpeedSpaceChart';
import { useTranslation } from 'react-i18next';
import { AllowancesSettings } from 'reducers/osrdsimulation/types';
import { SimulationReport } from 'common/api/osrdEditoastApi';
import SpaceTimeChart from 'modules/simulationResult/components/SpaceTimeChart/SpaceTimeChart';
import { useStoreDataForSpaceTimeChart } from 'modules/simulationResult/components/SpaceTimeChart/useStoreDataForSpaceTimeChart';
import { ChevronDown, ChevronUp } from '@osrd-project/ui-icons';

const OSRDStcdmResults = () => {
  const { t } = useTranslation(['translation', 'stdcm']);

  const [showSpeedSpaceChart, setShowSpeedSpaceChart] = useState(false);
  const [spaceTimeChartHeight, setSpaceTimeChartHeight] = useState(450);
  const [speedSpaceChartHeight, setSpeedSpaceChartHeight] = useState(450);

  const {
    selectedTrain,
    selectedProjection,
    simulation,
    simulationIsPlaying,
    dispatchUpdateSelectedTrainId,
    dispatchPersistentUpdateSimulation,
  } = useStoreDataForSpaceTimeChart();

  // by default, we show the ecoblocks for stdcm (if existing)
  const allowancesSettings = useMemo(
    () =>
      (simulation.trains as SimulationReport[]).reduce((acc, train) => {
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
      }, {} as AllowancesSettings),
    [simulation.trains]
  );

  return (
    <main className="osrd-config-mastcontainer" style={{ height: '115vh' }}>
      <div className="osrd-simulation-container mb-2 simulation-results">
        <div className="osrd-config-item mb-2">
          <div className="osrd-simulation-container mb-2">
            <p className="mt-2 mb-3 ml-4 font-weight-bold">{t('stdcm:spaceTimeGraphic')}</p>
            <div className="chart-container mt-2" style={{ height: `${spaceTimeChartHeight}px` }}>
              <SpaceTimeChart
                allowancesSettings={allowancesSettings}
                inputSelectedTrain={selectedTrain}
                selectedProjection={selectedProjection}
                simulation={simulation}
                simulationIsPlaying={simulationIsPlaying}
                initialHeight={450}
                onSetBaseHeight={setSpaceTimeChartHeight}
                dispatchUpdateSelectedTrainId={dispatchUpdateSelectedTrainId}
                dispatchPersistentUpdateSimulation={dispatchPersistentUpdateSimulation}
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
              {t('stdcm:spaceSpeedGraphic')}
              <span className="ml-auto">
                {showSpeedSpaceChart ? <ChevronUp /> : <ChevronDown />}
              </span>
            </div>
            {showSpeedSpaceChart && selectedTrain && (
              <div
                className="chart-container"
                style={{ height: `${speedSpaceChartHeight}px`, marginBottom: '50px' }}
              >
                <SpeedSpaceChart
                  initialHeight={450}
                  onSetChartBaseHeight={setSpeedSpaceChartHeight}
                  selectedTrain={selectedTrain}
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
