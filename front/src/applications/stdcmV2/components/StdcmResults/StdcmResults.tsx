import { useMemo, useState } from 'react';

import { Button } from '@osrd-project/ui-core';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import SimulationReportSheet from 'applications/stdcm/components/SimulationReportSheet';
import {
  generateCodeNumber,
  getOperationalPointsWithTimes,
} from 'applications/stdcm/utils/formatSimulationReportSheet';
import type { StdcmSimulation } from 'applications/stdcmV2/types';
import { Map } from 'modules/trainschedule/components/ManageTrainSchedule';

import StcdmResultsTable from './StdcmResultsTable';
import StdcmSimulationNavigator from './StdcmSimulationNavigator';
import StdcmUpgrade from './StdcmUpgrade';

type StcdmResultsV2Props = {
  simulationsList: StdcmSimulation[];
  selectedSimulationIndex: number;
  retainedSimulationIndex: number;
  showStatusBanner: boolean;
  isCalculationFailed: boolean;
  onRetainSimulation: () => void;
  onSelectSimulation: (simulationIndex: number) => void;
  onStartNewQuery: () => void;
};

const StcdmResults = ({
  simulationsList,
  selectedSimulationIndex,
  retainedSimulationIndex,
  showStatusBanner,
  isCalculationFailed,
  onRetainSimulation,
  onSelectSimulation,
  onStartNewQuery,
}: StcdmResultsV2Props) => {
  const { t } = useTranslation('stdcm', { keyPrefix: 'simulation.results' });

  const [mapCanvas, setMapCanvas] = useState<string>();

  const selectedSimulation = simulationsList[selectedSimulationIndex];

  const simulationReportSheetNumber = generateCodeNumber();

  const isSelectedSimulationRetained = selectedSimulationIndex === retainedSimulationIndex;

  const operationalPointsList = useMemo(() => {
    if (!selectedSimulation || !selectedSimulation.outputs) {
      return [];
    }

    return getOperationalPointsWithTimes(
      selectedSimulation.outputs.pathProperties?.suggestedOperationalPoints || [],
      selectedSimulation.outputs.results.simulation,
      selectedSimulation.outputs.results.departure_time
    );
  }, [selectedSimulation]);

  return (
    <>
      <StdcmSimulationNavigator
        simulationsList={simulationsList}
        selectedSimulationIndex={selectedSimulationIndex}
        showStatusBanner={showStatusBanner}
        isCalculationFailed={isCalculationFailed}
        onSelectSimulation={onSelectSimulation}
        retainedSimulationIndex={retainedSimulationIndex}
      />
      <div className="simulation-results">
        {selectedSimulation.outputs ? (
          <div className="results-and-sheet">
            <StcdmResultsTable
              stdcmData={selectedSimulation.outputs.results}
              isSimulationRetained={isSelectedSimulationRetained}
              operationalPointsList={operationalPointsList}
              onRetainSimulation={onRetainSimulation}
            />
            {isSelectedSimulationRetained ? (
              <div className="get-simulation">
                <div className="download-simulation">
                  <PDFDownloadLink
                    document={
                      <SimulationReportSheet
                        stdcmData={selectedSimulation.outputs.results}
                        simulationReportSheetNumber={simulationReportSheetNumber}
                        mapCanvas={mapCanvas}
                        operationalPointsList={operationalPointsList}
                      />
                    }
                    fileName={`STDCM-${simulationReportSheetNumber}.pdf`}
                  >
                    <Button label={t('downloadSimulationSheet')} onClick={() => {}} />
                  </PDFDownloadLink>
                </div>
                <div className="gesico-text">{t('gesicoRequest')}</div>
              </div>
            ) : (
              <StdcmUpgrade />
            )}
            {retainedSimulationIndex > -1 && (
              <div className="start-new-query">
                <Button variant="Normal" label={t('startNewQuery')} onClick={onStartNewQuery} />
              </div>
            )}
          </div>
        ) : (
          <div className="simulation-failure">
            <span className="title">{t('notFound')}</span>
            <span className="change-criteria">{t('changeCriteria')}</span>
          </div>
        )}
        <div className="osrd-config-item-container osrd-config-item-container-map map-results no-pointer-events">
          <Map
            mapId="map-result"
            isReadOnly
            hideAttribution
            setMapCanvas={setMapCanvas}
            pathProperties={selectedSimulation.outputs?.pathProperties}
            simulationPathSteps={selectedSimulation.outputs?.results.simulationPathSteps}
          />
        </div>
      </div>
    </>
  );
};

export default StcdmResults;
