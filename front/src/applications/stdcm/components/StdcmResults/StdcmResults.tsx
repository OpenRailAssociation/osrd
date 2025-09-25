import { useEffect, useMemo, useState } from 'react';

import { Button } from '@osrd-project/ui-core';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { useTranslation, Trans } from 'react-i18next';
import { useSelector } from 'react-redux';

import type { SimilarTrainWithSecondaryCode, StdcmResultsOutput } from 'applications/stdcm/types';
import { extractMarkersInfo } from 'applications/stdcm/utils';
import { addSecondaryCodesToSimilarTrains } from 'applications/stdcm/utils/addSecondaryCodesToSimilarTrains';
import { hasResults } from 'applications/stdcm/utils/simulationOutputUtils';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import DefaultBaseMap from 'common/Map/DefaultBaseMap';
import {
  generateCodeNumber,
  getOperationalPointsWithTimes,
} from 'modules/SimulationReportSheet/utils/formatSimulationReportSheet';
import { useMapSettings } from 'reducers/commonMap';
import type { Viewport } from 'reducers/commonMap/types';
import {
  getRetainedSimulationIndex,
  getSelectedSimulation,
  getStdcmInfraID,
  getStdcmTimetableID,
} from 'reducers/osrdconf/stdcmConf/selectors';
import useDeploymentSettings from 'utils/hooks/useDeploymentSettings';

import StdcmDebugResults from './StdcmDebugResults';
import StdcmFeedback from './StdcmFeedback';
import StcdmResultsTable from './StdcmResultsTable';
import StdcmSimulationNavigator from './StdcmSimulationNavigator';
import StdcmSimulationReportSheet from './StdcmSimulationReportSheet';

type StcdmResultsProps = {
  isCalculationFailed: boolean;
  isDebugMode: boolean;
  onSelectSimulation: (simulationIndex: number) => void;
  onStartNewQuery: () => void;
  onStartNewQueryWithData: () => void;
  buttonsVisible: boolean;
  showStatusBanner: boolean;
  displayInfoMessage: boolean;
};

const StdcmResults = ({
  isCalculationFailed,
  isDebugMode,
  onSelectSimulation,
  onStartNewQuery,
  onStartNewQueryWithData,
  buttonsVisible,
  showStatusBanner,
  displayInfoMessage,
}: StcdmResultsProps) => {
  const infraId = useSelector(getStdcmInfraID);
  const timetableId = useSelector(getStdcmTimetableID);

  const { t } = useTranslation('stdcm', { keyPrefix: 'simulation.results' });
  const deploymentSettings = useDeploymentSettings();

  const selectedSimulation = useSelector(getSelectedSimulation);
  const retainedSimulationIndex = useSelector(getRetainedSimulationIndex);

  const mapSettings = useMapSettings();

  // Keep local state of the viewport to keep stdcm config and stdcm results maps independent
  const [stdcmResultsViewport, setStdcmResultsViewport] = useState<Viewport>(mapSettings.viewport);

  const updateViewport = (viewport: Viewport) => {
    setStdcmResultsViewport(viewport);
  };

  const { outputs, alternativePath } = selectedSimulation;

  const hasSimulationResults = hasResults(outputs);

  const simulationReportSheetNumber = generateCodeNumber();
  const isSelectedSimulationRetained =
    retainedSimulationIndex !== undefined && selectedSimulation.index === retainedSimulationIndex;

  const operationalPointsList = useMemo(() => {
    if (!hasSimulationResults) return [];
    return getOperationalPointsWithTimes(
      outputs.pathProperties?.suggestedOperationalPoints || [],
      outputs.results.simulation,
      outputs.results.simulationPathSteps,
      new Date(outputs.results.departure_time)
    );
  }, [outputs]);

  const markersInfo = useMemo(() => {
    if (!hasSimulationResults) {
      return [];
    }
    return extractMarkersInfo(outputs.results.simulationPathSteps);
  }, [hasSimulationResults, outputs]);

  const [similarTrains, setSimilarTrains] = useState<SimilarTrainWithSecondaryCode[]>([]);

  const [postSimilarTrains] = osrdEditoastApi.endpoints.postSimilarTrains.useMutation();

  useEffect(() => {
    const searchForSimilarTrains = async () => {
      const { consist, pathSteps } = selectedSimulation.inputs;
      if (!consist || !hasSimulationResults) {
        return;
      }
      const key = (uic: number | undefined, ch: string) => `${uic}-${ch}`;

      const isStopByOpKey = pathSteps.reduce((acc, ps) => {
        const k = key(ps.location?.uic, ps.location?.secondary_code ?? '');
        acc.set(k, !ps.isVia || ps.stopFor !== undefined);
        return acc;
      }, new Map<string, boolean>());

      const waypoints = (
        (selectedSimulation.outputs as StdcmResultsOutput).pathProperties
          .manchetteOperationalPoints ?? []
      ).map((op) => {
        const k = key(op.extensions?.identifier?.uic, op.extensions?.sncf?.ch ?? '');
        return {
          id: op.opId!,
          stop: isStopByOpKey.get(k) ?? false,
        };
      });

      const request = {
        infra_id: infraId,
        rolling_stock: {
          name: consist.tractionEngine?.name ?? '',
          speed_limit_tag: consist.speedLimitByTag,
        },
        timetable_id: timetableId,
        waypoints,
      };

      const response = await postSimilarTrains({ body: request });
      const rawSimilarTrains = response.data?.similar_trains ?? [];

      const enrichedSimilarTrains = addSecondaryCodesToSimilarTrains(
        rawSimilarTrains,
        (selectedSimulation.outputs as StdcmResultsOutput).pathProperties.manchetteOperationalPoints
      );

      setSimilarTrains(enrichedSimilarTrains);
    };
    if (isSelectedSimulationRetained) {
      searchForSimilarTrains();
    }
  }, [isSelectedSimulationRetained]);

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
            <div className="results-with-feedback">
              {alternativePath && (
                <div className="alternative-path-message">
                  <span className="stdcm-header__notification alternative-path">
                    {alternativePath === 'upstream' ? (
                      <Trans components={{ underline: <u /> }}>{t('simulationUpstream')}</Trans>
                    ) : (
                      <Trans components={{ underline: <u /> }}>{t('simulationDownstream')}</Trans>
                    )}
                  </span>
                </div>
              )}
              {hasSimulationResults ? (
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
                      <div className="download-simulation" data-testid="download-simulation">
                        <PDFDownloadLink
                          document={
                            <StdcmSimulationReportSheet
                              stdcmLinkedTrains={selectedSimulation.inputs.linkedTrains}
                              stdcmData={outputs.results}
                              consist={selectedSimulation.inputs.consist}
                              simulationReportSheetNumber={simulationReportSheetNumber}
                              operationalPointsList={operationalPointsList}
                              simulationSheetLogo={deploymentSettings?.stdcmSimulationSheetLogo}
                              similarTrains={similarTrains}
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
                        dataTestID="start-new-query-button"
                        variant="Primary"
                        label={t('startNewQuery')}
                        onClick={onStartNewQuery}
                      />
                      <Button
                        className="start-new-query-with-data"
                        dataTestID="start-new-query-with-data-button"
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
                  <span className="change-criteria">{t('pathNotFound')}</span>
                  <span>{t('changeSearchCriteria')}</span>
                  {!alternativePath && !displayInfoMessage && (
                    <div className="alternative-simulations-info">
                      {t('simulationsWithConflicts')}
                    </div>
                  )}
                </div>
              )}
              <StdcmFeedback />
            </div>

            <div className="osrd-config-item-container osrd-config-item-container-map map-results">
              <DefaultBaseMap
                mapId="stdcm-map-result"
                infraId={infraId}
                geometry={hasSimulationResults ? outputs?.pathProperties.geometry : undefined}
                pathStepMarkers={markersInfo}
                isFeasible={hasSimulationResults}
                mapSettings={{ ...mapSettings, viewport: stdcmResultsViewport }}
                updateViewport={updateViewport}
              />
            </div>
          </div>

          {isDebugMode && <StdcmDebugResults simulationOutputs={outputs} />}
        </>
      )}
    </>
  );
};

export default StdcmResults;
