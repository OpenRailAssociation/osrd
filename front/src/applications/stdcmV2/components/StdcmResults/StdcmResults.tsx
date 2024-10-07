import { useMemo, useState } from 'react';

import { Button } from '@osrd-project/ui-core';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import SimulationReportSheet from 'applications/stdcm/components/SimulationReportSheet';
import { STDCM_TRAIN_ID } from 'applications/stdcm/consts';
import useProjectedTrainsForStdcm from 'applications/stdcm/hooks/useProjectedTrainsForStdcm';
import {
  generateCodeNumber,
  getOperationalPointsWithTimes,
} from 'applications/stdcm/utils/formatSimulationReportSheet';
import type { StdcmSimulation } from 'applications/stdcmV2/types';
import i18n from 'i18n';
import ManchetteWithSpaceTimeChartWrapper from 'modules/simulationResult/components/ManchetteWithSpaceTimeChart/ManchetteWithSpaceTimeChart';
import SpeedSpaceChartContainer from 'modules/simulationResult/components/SpeedSpaceChart/SpeedSpaceChartContainer';
import { Map } from 'modules/trainschedule/components/ManageTrainSchedule';

import StcdmResultsTable from './StdcmResultsTable';
import StdcmSimulationNavigator from './StdcmSimulationNavigator';
import { compact } from 'lodash';

type StcdmResultsV2Props = {
  isCalculationFailed: boolean;
  isDebugMode: boolean;
  onRetainSimulation: () => void;
  onSelectSimulation: (simulationIndex: number) => void;
  onStartNewQuery: () => void;
  retainedSimulationIndex: number;
  selectedSimulationIndex: number;
  showStatusBanner: boolean;
  simulationsList: StdcmSimulation[];
};

const SPEED_SPACE_CHART_HEIGHT = 521.5;
const HANDLE_TAB_RESIZE_HEIGHT = 20;

const StcdmResults = ({
  isCalculationFailed,
  isDebugMode,
  onRetainSimulation,
  onSelectSimulation,
  onStartNewQuery,
  retainedSimulationIndex,
  selectedSimulationIndex,
  showStatusBanner,
  simulationsList,
}: StcdmResultsV2Props) => {
  const { t } = useTranslation('stdcm', { keyPrefix: 'simulation.results' });
  const tWithoutPrefix = i18n.getFixedT(null, 'stdcm');

  const [mapCanvas, setMapCanvas] = useState<string>();
  const [speedSpaceChartContainerHeight, setSpeedSpaceChartContainerHeight] =
    useState(SPEED_SPACE_CHART_HEIGHT);

  const selectedSimulation = simulationsList[selectedSimulationIndex];
  const spaceTimeData = useProjectedTrainsForStdcm(selectedSimulation.outputs?.results);
  const speedSpaceChartData = selectedSimulation?.outputs?.speedSpaceChartData;

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
            {isSelectedSimulationRetained && (
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
            showStdcmAssets
            setMapCanvas={setMapCanvas}
            geometry={selectedSimulation.outputs?.pathProperties?.geometry}
            simulationPathSteps={compact(
              selectedSimulation.inputs.pathSteps.map((step) => step.location)
            )}
          />
        </div>
      </div>
      {/* TODO: Replace this part with the spaceTimeChartWithManchette component once it's merged (ui-manchette #504) */}
      {isDebugMode && (
        <>
          {spaceTimeData &&
            spaceTimeData.length > 0 &&
            selectedSimulation.outputs &&
            selectedSimulation.outputs.pathProperties.manchetteOperationalPoints && (
              <div className="osrd-simulation-container mb-2">
                <p className="mt-2 mb-3 ml-4 font-weight-bold">
                  {tWithoutPrefix('spaceTimeGraphic')}
                </p>
                <div className="chart-container mt-2">
                  <ManchetteWithSpaceTimeChartWrapper
                    operationalPoints={
                      selectedSimulation.outputs?.pathProperties.manchetteOperationalPoints
                    }
                    projectPathTrainResult={spaceTimeData}
                    selectedTrainScheduleId={STDCM_TRAIN_ID}
                  />
                </div>
              </div>
            )}

          <div className="osrd-simulation-container my-2 speedspacechart-container">
            <div
              className="chart-container"
              style={{
                height: `${speedSpaceChartContainerHeight + HANDLE_TAB_RESIZE_HEIGHT}px`,
              }}
            >
              {selectedSimulation.outputs && speedSpaceChartData && (
                <SpeedSpaceChartContainer
                  trainSimulation={selectedSimulation.outputs.results.simulation}
                  selectedTrainPowerRestrictions={speedSpaceChartData.formattedPowerRestrictions}
                  pathProperties={speedSpaceChartData.formattedPathProperties}
                  heightOfSpeedSpaceChartContainer={speedSpaceChartContainerHeight}
                  setHeightOfSpeedSpaceChartContainer={setSpeedSpaceChartContainerHeight}
                  rollingStock={speedSpaceChartData.rollingStock}
                />
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default StcdmResults;
