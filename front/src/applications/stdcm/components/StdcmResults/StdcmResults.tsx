import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@osrd-project/ui-core';
import { CheckCircle } from '@osrd-project/ui-icons';
import { usePDF } from '@react-pdf/renderer';
import { skipToken } from '@reduxjs/toolkit/query';
import fileDownload from 'js-file-download';
import { head, last } from 'lodash';
import { useTranslation, Trans } from 'react-i18next';
import { useSelector } from 'react-redux';

import type { SimilarTrainWithSecondaryCode, StdcmResultsOutput } from 'applications/stdcm/types';
import { extractMarkersInfo, mergeSimilarTrainSegments } from 'applications/stdcm/utils';
import { addSecondaryCodesToSimilarTrains } from 'applications/stdcm/utils/addSecondaryCodesToSimilarTrains';
import { hasResults } from 'applications/stdcm/utils/simulationOutputUtils';
import { osrdEditoastApi, type PostSimilarTrainsApiResponse } from 'common/api/osrdEditoastApi';
import {
  osrdRailwayManagerApi,
  type SendLastMinuteRequestResponse,
} from 'common/api/osrdRailwayManagerApi';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import DefaultBaseMap from 'common/Map/DefaultBaseMap';
import {
  generateCodeNumber,
  getOperationalPointsWithTimes,
} from 'modules/SimulationReportSheet/utils/formatSimulationReportSheet';
import { defaultMapSettings } from 'reducers/commonMap';
import type { MapSettings, Viewport } from 'reducers/commonMap/types';
import { getRailwayManagerInterfaceUrl } from 'reducers/main/mainSelector';
import {
  getOperationalPointsIdFiltered,
  getRetainedSimulationIndex,
  getSelectedSimulation,
  getStdcmInfraID,
} from 'reducers/osrdconf/stdcmConf/selectors';
import useDeploymentSettings from 'utils/hooks/useDeploymentSettings';

import SendToRailwayManagerModal from './SendToRailwayManagerModal';
import StdcmFeedback from './StdcmFeedback';
import StdcmResultsTable from './StdcmResultsTable';
import StdcmSimulationNavigator from './StdcmSimulationNavigator';
import StdcmSimulationReportSheet from './StdcmSimulationReportSheet';

const MINIMUM_OP_WEIGHT = 10;

type StdcmResultsProps = {
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
}: StdcmResultsProps) => {
  const infraId = useSelector(getStdcmInfraID);
  const { openModal, closeModal } = useModal();
  const railwayManagerUrl = useSelector(getRailwayManagerInterfaceUrl);
  const [isRailwayRequestSuccessful, setIsRailwayRequestSuccessful] = useState(false);
  const [railwayDemandId, setRailwayDemandId] = useState<string>();
  const [railwayRequestUrl, setRailwayRequestUrl] = useState<string | null>();

  const [pdfInstance, updatePdfInstance] = usePDF({});

  const { t } = useTranslation('stdcm', { keyPrefix: 'simulation.results' });
  const deploymentSettings = useDeploymentSettings();

  const selectedSimulation = useSelector(getSelectedSimulation);
  const retainedSimulationIndex = useSelector(getRetainedSimulationIndex);

  const opIdsToExclude = useSelector(getOperationalPointsIdFiltered);

  // Keep local state of the map settings to keep stdcm config and stdcm results maps independent
  const [mapSettings, setMapSettings] = useState(defaultMapSettings);

  const { data: sendLMRAuthorizedResponse } =
    osrdRailwayManagerApi.endpoints.getSendLastMinuteRequestAuthorized.useQuery(
      railwayManagerUrl ? undefined : skipToken
    );

  const updateMapSettings = useCallback(
    (value: Partial<MapSettings>) => setMapSettings((prev) => ({ ...prev, ...value })),
    [setMapSettings]
  );

  const updateViewport = (viewport: Viewport) => updateMapSettings({ viewport });

  const { outputs, alternativePath } = selectedSimulation;

  const hasSimulationResults = hasResults(outputs);
  const traceId = outputs && ('results' in outputs ? outputs.results.traceId : outputs.traceId);

  const simulationReportSheetNumber = useMemo(
    () => generateCodeNumber(),
    [selectedSimulation.index]
  );
  const isSelectedSimulationRetained =
    retainedSimulationIndex !== undefined && selectedSimulation.index === retainedSimulationIndex;

  const operationalPointsList = useMemo(() => {
    if (!hasSimulationResults) return [];
    return getOperationalPointsWithTimes({
      operationalPoints: outputs.pathProperties?.operational_points || [],
      suggestedOperationalPoints: outputs.pathProperties?.suggestedOperationalPoints || [],
      opIdsToExclude,
      simulation: outputs.results.simulation,
      simulationPathSteps: outputs.results.simulationPathSteps,
      departureTime: new Date(outputs.results.departure_time),
    }).filter(({ weight, stopType }) => stopType || (weight && weight >= MINIMUM_OP_WEIGHT));
  }, [outputs]);

  const markersInfo = useMemo(() => {
    if (!hasSimulationResults) {
      return [];
    }
    return extractMarkersInfo(outputs.results.simulationPathSteps);
  }, [hasSimulationResults, outputs]);

  const [similarTrains, setSimilarTrains] = useState<SimilarTrainWithSecondaryCode[]>([]);
  const [areSegmentsLoading, setAreSegmentsLoading] = useState(true);

  const [postSimilarTrains] = osrdEditoastApi.endpoints.postSimilarTrains.useMutation();

  const handleSubmitSuccess = (
    isSuccessful: boolean,
    railwayResponse: SendLastMinuteRequestResponse
  ) => {
    if (isSuccessful) {
      setIsRailwayRequestSuccessful(isSuccessful);
      setRailwayDemandId(railwayResponse.request_identifier);
      setRailwayRequestUrl(railwayResponse.created_request_url);
    }
  };

  useEffect(() => {
    const searchForSimilarTrains = async () => {
      try {
        const { consist, pathSteps } = selectedSimulation.inputs;
        if (!consist || !hasSimulationResults) {
          return;
        }

        const key = (mainCode: string, secondaryCode: string) => `${mainCode}-${secondaryCode}`;

        const isStopByOpKey = pathSteps.reduce((acc, ps) => {
          const k = key(
            ps.operationalPoint?.mainCode ?? '',
            ps.operationalPoint?.secondaryCode ?? ''
          );
          acc.set(k, !ps.isVia || ps.stopFor !== undefined);
          return acc;
        }, new Map<string, boolean>());

        const waypoints = (
          (selectedSimulation.outputs as StdcmResultsOutput).pathProperties
            .manchetteOperationalPoints ?? []
        ).map((op) => {
          const k = key(op.main_code, op.secondary_code ?? '');
          return {
            id: op.opId!,
            stop: isStopByOpKey.get(k) ?? false,
          };
        });

        const hasNullTrains = (trains: PostSimilarTrainsApiResponse['similar_trains']) =>
          trains.some((segment) => segment.train === null);

        // Call 1: Full criteria
        const fullCriteriaResponse = await postSimilarTrains({
          body: {
            waypoints,
            rolling_stock: {
              name: consist.tractionEngine?.name ?? '',
              speed_limit_tag: consist.speedLimitByTag,
            },
          },
        });

        const fullCriteriaSegments = fullCriteriaResponse.data?.similar_trains ?? [];

        // Checking if similar train API has data or not
        // If not, we can skip others call and set the similar train with the default value
        if (
          fullCriteriaResponse &&
          fullCriteriaResponse.error &&
          'data' in fullCriteriaResponse.error &&
          fullCriteriaResponse.error.data.type ===
            'editoast:timetable:similar_trains:EmptyTrainsTraffic'
        ) {
          const emptySimilarTrains = addSecondaryCodesToSimilarTrains(
            [
              {
                train: null,
                begin: head(waypoints)!.id,
                end: last(waypoints)!.id,
              },
            ],
            (selectedSimulation.outputs as StdcmResultsOutput).pathProperties
              .manchetteOperationalPoints
          );
          setSimilarTrains(emptySimilarTrains);
          return;
        }

        // Call 2: Only speed_limit_tag (if needed)
        const segmentsWithSpeedLimitTagConstraint =
          hasNullTrains(fullCriteriaSegments) && consist.speedLimitByTag
            ? (
                await postSimilarTrains({
                  body: {
                    waypoints,
                    rolling_stock: { speed_limit_tag: consist.speedLimitByTag },
                  },
                })
              ).data?.similar_trains
            : null;

        // Call 3: Only name (if still needed)
        const segmentsWithRsNameConstraint =
          segmentsWithSpeedLimitTagConstraint &&
          hasNullTrains(segmentsWithSpeedLimitTagConstraint) &&
          consist.tractionEngine?.name
            ? (
                await postSimilarTrains({
                  body: {
                    waypoints,
                    rolling_stock: { name: consist.tractionEngine.name },
                  },
                })
              ).data?.similar_trains
            : null;

        const mergedTrains = mergeSimilarTrainSegments(
          fullCriteriaSegments,
          segmentsWithSpeedLimitTagConstraint ?? null,
          segmentsWithRsNameConstraint ?? null
        );

        const enrichedSimilarTrains = addSecondaryCodesToSimilarTrains(
          mergedTrains,
          (selectedSimulation.outputs as StdcmResultsOutput).pathProperties
            .manchetteOperationalPoints
        );

        setSimilarTrains(enrichedSimilarTrains);
      } catch (err) {
        console.error('Searching for similar trains failed', err);
      } finally {
        setAreSegmentsLoading(false);
      }
    };

    if (isSelectedSimulationRetained) {
      searchForSimilarTrains();
    }
  }, [isSelectedSimulationRetained]);

  useEffect(() => {
    if (hasSimulationResults && isSelectedSimulationRetained && outputs)
      updatePdfInstance(
        <StdcmSimulationReportSheet
          stdcmLinkedTrains={selectedSimulation.inputs.linkedTrains}
          stdcmData={outputs.results}
          consist={selectedSimulation.inputs.consist}
          simulationReportSheetNumber={simulationReportSheetNumber}
          operationalPointsList={operationalPointsList}
          simulationSheetLogo={deploymentSettings?.stdcmSimulationSheetLogo}
          similarTrains={similarTrains}
        />
      );
  }, [
    updatePdfInstance,
    outputs,
    hasSimulationResults,
    isSelectedSimulationRetained,
    simulationReportSheetNumber,
    operationalPointsList,
    selectedSimulation.inputs,
    deploymentSettings?.stdcmSimulationSheetLogo,
    similarTrains,
  ]);

  const downloadPdf = useCallback(() => {
    fileDownload(
      pdfInstance.blob!,
      `${deploymentSettings?.stdcmName || 'Stdcm'}-${simulationReportSheetNumber}.pdf`
    );
  }, [pdfInstance, deploymentSettings, simulationReportSheetNumber]);

  const openSendToRailwayManagerModal = useCallback(() => {
    if (hasSimulationResults) {
      openModal(
        <SendToRailwayManagerModal
          consist={selectedSimulation.inputs.consist}
          stdcmResults={outputs}
          linkedTrains={selectedSimulation.inputs.linkedTrains}
          simulationReportSheetNumber={simulationReportSheetNumber}
          similarTrains={similarTrains}
          pdfBlob={pdfInstance.blob!}
          onClose={closeModal}
          onSuccess={handleSubmitSuccess}
        />,
        'xl',
        'no-close-modal'
      );
    }
  }, [
    closeModal,
    handleSubmitSuccess,
    openModal,
    outputs,
    selectedSimulation.inputs.consist,
    selectedSimulation.inputs.linkedTrains,
    simulationReportSheetNumber,
    similarTrains,
    pdfInstance.blob,
  ]);

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
                  <StdcmResultsTable
                    stdcmData={outputs.results}
                    consist={selectedSimulation.inputs.consist}
                    isSimulationRetained={isSelectedSimulationRetained}
                    operationalPointsList={operationalPointsList}
                    simulationIndex={selectedSimulation.index}
                  />
                  {isSelectedSimulationRetained && (
                    <div className="get-simulation">
                      <div className="download-simulation" data-testid="download-simulation">
                        <Button
                          data-testid="download-simulation-button"
                          label={t('downloadSimulationSheet')}
                          onClick={downloadPdf}
                          isDisabled={areSegmentsLoading || pdfInstance.loading}
                          variant="Normal"
                          isLoading={pdfInstance.loading}
                        />
                      </div>
                      {railwayManagerUrl &&
                        sendLMRAuthorizedResponse?.authorized &&
                        (!isRailwayRequestSuccessful ? (
                          <Button
                            label={t('transferSheetToRailManager')}
                            isDisabled={pdfInstance.loading}
                            isLoading={pdfInstance.loading}
                            onClick={openSendToRailwayManagerModal}
                          />
                        ) : (
                          <div className="success-message">
                            <span>
                              <Trans
                                components={{
                                  requestNumber: railwayRequestUrl ? (
                                    <a
                                      href={railwayRequestUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="request-link"
                                    >
                                      {railwayDemandId}
                                    </a>
                                  ) : (
                                    // eslint-disable-next-line react/jsx-no-useless-fragment
                                    <>{railwayDemandId}</>
                                  ),
                                }}
                              >
                                {t('modal.successMessage')}
                              </Trans>
                            </span>
                            <CheckCircle className="check-circle" variant="fill" />
                          </div>
                        ))}
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
                mapSettings={mapSettings}
                updateMapSettings={updateMapSettings}
                updateViewport={updateViewport}
              />
            </div>
          </div>
          {isDebugMode && traceId && (
            <a
              href={`/stdcm/debug?traceId=${encodeURIComponent(traceId)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="stdcm-debug-link"
            >
              Link to debug page with more simulation details
            </a>
          )}
        </>
      )}
    </>
  );
};

export default StdcmResults;
