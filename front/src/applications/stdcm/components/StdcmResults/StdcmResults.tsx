import { useMemo } from 'react';

import { Button } from '@osrd-project/ui-core';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { useTranslation, Trans } from 'react-i18next';

import useConflictsMessages from 'applications/stdcm/hooks/useConflictsMessages';
import type { StdcmSimulation } from 'applications/stdcm/types';
import { extractMarkersInfo } from 'applications/stdcm/utils';
import {
  generateCodeNumber,
  getOperationalPointsWithTimes,
} from 'applications/stdcm/utils/formatSimulationReportSheet';
import { hasConflicts, hasResults } from 'applications/stdcm/utils/simulationOutputUtils';
import NewMap from 'modules/trainschedule/components/ManageTrainSchedule/NewMap';
import useDeploymentSettings from 'utils/hooks/useDeploymentSettings';

import SimulationReportSheet from './SimulationReportSheet';
import StdcmDebugResults from './StdcmDebugResults';
import StcdmResultsTable from './StdcmResultsTable';
import StdcmSimulationNavigator from './StdcmSimulationNavigator';

type StcdmResultsProps = {
  isCalculationFailed: boolean;
  isDebugMode: boolean;
  onRetainSimulation: () => void;
  onSelectSimulation: (simulationIndex: number) => void;
  onStartNewQuery: () => void;
  onStartNewQueryWithData: () => void;
  buttonsVisible: boolean;
  retainedSimulationIndex: number;
  selectedSimulationIndex: number;
  showStatusBanner: boolean;
  simulationsList: StdcmSimulation[];
};

const StcdmResults = ({
  isCalculationFailed,
  isDebugMode,
  onRetainSimulation,
  onSelectSimulation,
  onStartNewQuery,
  onStartNewQueryWithData,
  buttonsVisible,
  retainedSimulationIndex,
  selectedSimulationIndex,
  showStatusBanner,
  simulationsList,
}: StcdmResultsProps) => {
  const { t } = useTranslation('stdcm', { keyPrefix: 'simulation.results' });
  const { stdcmName } = useDeploymentSettings();

  const selectedSimulation = simulationsList[selectedSimulationIndex];
  const { outputs } = selectedSimulation || {};

  const hasConflictResults = hasConflicts(outputs);
  const hasSimulationResults = hasResults(outputs);

  const { trackConflicts, workConflicts } = useConflictsMessages(t, outputs);

  const simulationReportSheetNumber = generateCodeNumber();
  const isSelectedSimulationRetained = selectedSimulationIndex === retainedSimulationIndex;

  const operationalPointsList = useMemo(() => {
    if (!hasSimulationResults) return [];
    return getOperationalPointsWithTimes(
      outputs.pathProperties?.suggestedOperationalPoints || [],
      outputs.results.simulation,
      outputs.results.simulationPathSteps,
      outputs.results.departure_time
    );
  }, [outputs]);

  const markersInfo = useMemo(() => {
    if (!hasSimulationResults) {
      return [];
    }
    return extractMarkersInfo(outputs.results.simulationPathSteps);
  }, [hasSimulationResults, outputs]);

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
        {hasSimulationResults && !hasConflictResults ? (
          <div className="results-and-sheet">
            <StcdmResultsTable
              stdcmData={outputs.results}
              consist={selectedSimulation.inputs.consist}
              isSimulationRetained={isSelectedSimulationRetained}
              operationalPointsList={operationalPointsList}
              onRetainSimulation={onRetainSimulation}
            />
            {isSelectedSimulationRetained && (
              <div className="get-simulation">
                <div className="download-simulation">
                  <PDFDownloadLink
                    document={
                      <SimulationReportSheet
                        stdcmLinkedTrains={selectedSimulation.inputs.linkedTrains}
                        stdcmData={outputs.results}
                        consist={selectedSimulation.inputs.consist}
                        simulationReportSheetNumber={simulationReportSheetNumber}
                        operationalPointsList={operationalPointsList}
                      />
                    }
                    fileName={`${stdcmName}-${simulationReportSheetNumber}.pdf`}
                  >
                    <Button
                      data-testid="download-simulation-button"
                      label={t('downloadSimulationSheet')}
                      onClick={() => {}}
                    />
                  </PDFDownloadLink>
                </div>
                <div className="gesico-text">{t('gesicoRequest')}</div>
              </div>
            )}
            {retainedSimulationIndex > -1 && buttonsVisible && (
              <div className="start-new-query">
                <Button
                  data-testid="start-new-query-button"
                  variant="Primary"
                  label={t('startNewQuery')}
                  onClick={onStartNewQuery}
                />
                <Button
                  className="start-new-query-with-data"
                  data-testid="start-new-query-with-data-button"
                  variant="Normal"
                  label={t('startNewQueryFromCurrent')}
                  onClick={onStartNewQueryWithData}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="simulation-failure">
            <span className="title">{t('notFound')}</span>
            <span className="change-criteria">{t('conflictsTitle')}</span>

            {trackConflicts.length > 0 && (
              <ul>
                {trackConflicts.map((message, index) => (
                  <li key={index}>
                    <span>
                      <Trans>&bull; {message}</Trans>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {trackConflicts.length > 0 && workConflicts.length > 0 && <br />}

            {workConflicts.length > 0 && (
              <ul>
                {workConflicts.map((message, index) => (
                  <li key={index}>
                    <span>
                      <Trans>&bull; {message}</Trans>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <span>{t('changeSearchCriteria')}</span>
          </div>
        )}
        <div className="osrd-config-item-container osrd-config-item-container-map map-results">
          <NewMap
            id="stdcm-map-result"
            hideAttribution
            showStdcmAssets
            isFeasible={!hasConflictResults}
            pathGeometry={outputs?.pathProperties?.geometry}
            simulationPathSteps={markersInfo}
          />
        </div>
      </div>
      {isDebugMode && <StdcmDebugResults simulationOutputs={outputs} />}
    </>
  );
};

export default StcdmResults;
