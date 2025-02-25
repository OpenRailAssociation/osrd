import { useMemo } from 'react';

import { Button } from '@osrd-project/ui-core';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { useTranslation, Trans } from 'react-i18next';
import { useSelector } from 'react-redux';

import useConflictsMessages from 'applications/stdcm/hooks/useConflictsMessages';
import { extractMarkersInfo } from 'applications/stdcm/utils';
import {
  generateCodeNumber,
  getOperationalPointsWithTimes,
} from 'applications/stdcm/utils/formatSimulationReportSheet';
import { hasConflicts, hasResults } from 'applications/stdcm/utils/simulationOutputUtils';
import DefaultBaseMap from 'common/Map/DefaultBaseMap';
import {
  getRetainedSimulationIndex,
  getSelectedSimulation,
  getStdcmInfraID,
} from 'reducers/osrdconf/stdcmConf/selectors';
import useDeploymentSettings from 'utils/hooks/useDeploymentSettings';

import SimulationReportSheet from './SimulationReportSheet';
import StdcmDebugResults from './StdcmDebugResults';
import FeedbackCard from './StdcmFeedback';
import StcdmResultsTable from './StdcmResultsTable';
import StdcmSimulationNavigator from './StdcmSimulationNavigator';

type StcdmResultsProps = {
  isCalculationFailed: boolean;
  isDebugMode: boolean;
  onSelectSimulation: (simulationIndex: number) => void;
  onStartNewQuery: () => void;
  onStartNewQueryWithData: () => void;
  buttonsVisible: boolean;
  showStatusBanner: boolean;
};

const StcdmResults = ({
  isCalculationFailed,
  isDebugMode,
  onSelectSimulation,
  onStartNewQuery,
  onStartNewQueryWithData,
  buttonsVisible,
  showStatusBanner,
}: StcdmResultsProps) => {
  const infraId = useSelector(getStdcmInfraID);

  const { t } = useTranslation('stdcm', { keyPrefix: 'simulation.results' });
  const deploymentSettings = useDeploymentSettings();

  const selectedSimulation = useSelector(getSelectedSimulation);
  const retainedSimulationIndex = useSelector(getRetainedSimulationIndex);

  const { outputs } = selectedSimulation;

  const hasConflictResults = hasConflicts(outputs);
  const hasSimulationResults = hasResults(outputs);

  const { trackConflicts, workConflicts } = useConflictsMessages(t, outputs);

  const simulationReportSheetNumber = generateCodeNumber();
  const isSelectedSimulationRetained =
    retainedSimulationIndex !== undefined && selectedSimulation.index === retainedSimulationIndex;

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
        selectedSimulationIndex={selectedSimulation.index}
        showStatusBanner={showStatusBanner}
        isCalculationFailed={isCalculationFailed}
        onSelectSimulation={onSelectSimulation}
        retainedSimulationIndex={retainedSimulationIndex}
      />
      {outputs && (
        <>
          <div className="simulation-results">
            {hasSimulationResults && !hasConflictResults ? (
              <div className="results-and-sheet">
                <StcdmResultsTable
                  stdcmData={outputs.results}
                  consist={selectedSimulation.inputs.consist}
                  isSimulationRetained={isSelectedSimulationRetained}
                  operationalPointsList={operationalPointsList}
                  simulationIndex={selectedSimulation.index}
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
                            simulationSheetLogo={deploymentSettings?.stdcmSimulationSheetLogo}
                          />
                        }
                        fileName={`${deploymentSettings?.stdcmName || 'Stdcm'}-${simulationReportSheetNumber}.pdf`}
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
                {retainedSimulationIndex !== undefined && buttonsVisible && (
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
                <FeedbackCard />
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
              <DefaultBaseMap
                mapId="stdcm-map-result"
                infraId={infraId}
                geometry={outputs?.pathProperties?.geometry}
                pathStepMarkers={markersInfo}
                isFeasible={!hasConflictResults}
              />
            </div>
          </div>
          {isDebugMode && <StdcmDebugResults simulationOutputs={outputs} />}
        </>
      )}
    </>
  );
};

export default StcdmResults;
