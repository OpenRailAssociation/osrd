import { useMemo, useState } from 'react';

import { Manchette as SpaceTimeChartWithManchette } from '@osrd-project/ui-manchette';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import { LoaderFill } from 'common/Loaders';
import SpeedSpaceChartContainer from 'modules/simulationResult/components/SpeedSpaceChart/SpeedSpaceChartContainer';

import SimulationReportSheet from '../components/SimulationReportSheet';
import { STDCM_TRAIN_ID } from '../consts';
import type { StdcmV2Results } from '../types';
import {
  generateCodeNumber,
  getOperationalPointsWithTimes,
} from '../utils/formatSimulationReportSheet';

const SPEED_SPACE_CHART_HEIGHT = 521.5;
const HANDLE_TAB_RESIZE_HEIGHT = 20;

type StcdmResultsProps = {
  mapCanvas?: string;
  stdcmV2Results: StdcmV2Results;
  pathProperties?: ManageTrainSchedulePathProperties;
};

const codeNumber = generateCodeNumber();

const StcdmResultsV2 = ({ mapCanvas, stdcmV2Results, pathProperties }: StcdmResultsProps) => {
  const { t } = useTranslation(['stdcm']);
  const [speedSpaceChartContainerHeight, setSpeedSpaceChartContainerHeight] =
    useState(SPEED_SPACE_CHART_HEIGHT);

  const { stdcmResponse, speedSpaceChartData, spaceTimeData } = stdcmV2Results;

  const operationalPointsList = useMemo(
    () =>
      getOperationalPointsWithTimes(
        pathProperties?.suggestedOperationalPoints || [],
        stdcmV2Results.stdcmResponse.simulation,
        stdcmV2Results.stdcmResponse.departure_time
      ),
    [pathProperties, stdcmV2Results]
  );

  return (
    <main className="osrd-config-mastcontainer" style={{ height: '115vh' }}>
      <div className="osrd-simulation-container mb-2 simulation-results">
        <div className="osrd-simulation-container mb-2">
          <p className="mt-2 mb-3 ml-4 font-weight-bold">{t('spaceTimeGraphic')}</p>
          <div className="chart-container mt-2">
            {spaceTimeData &&
            spaceTimeData.length > 0 &&
            pathProperties &&
            pathProperties.manchetteOperationalPoints ? (
              <SpaceTimeChartWithManchette
                operationalPoints={pathProperties.manchetteOperationalPoints}
                projectPathTrainResult={spaceTimeData}
                selectedProjection={STDCM_TRAIN_ID}
              />
            ) : (
              <LoaderFill />
            )}
          </div>
        </div>
        <div className="osrd-simulation-container mb-2 speedspacechart-container">
          <div
            className="chart-container"
            style={{
              height: `${speedSpaceChartContainerHeight + HANDLE_TAB_RESIZE_HEIGHT}px`,
            }}
          >
            {speedSpaceChartData ? (
              <SpeedSpaceChartContainer
                trainSimulation={stdcmResponse.simulation}
                selectedTrainPowerRestrictions={speedSpaceChartData.formattedPowerRestrictions}
                pathProperties={speedSpaceChartData.formattedPathProperties}
                heightOfSpeedSpaceChartContainer={speedSpaceChartContainerHeight}
                setHeightOfSpeedSpaceChartContainer={setSpeedSpaceChartContainerHeight}
              />
            ) : (
              <LoaderFill />
            )}
          </div>
        </div>
        <div className="osrd-config-item-container">
          <button className="btn d-flex align-items-center mb-1 font-weight-bold" type="button">
            <PDFDownloadLink
              document={
                <SimulationReportSheet
                  stdcmData={stdcmResponse}
                  simulationReportSheetNumber={codeNumber}
                  mapCanvas={mapCanvas}
                  operationalPointsList={operationalPointsList}
                />
              }
              fileName={`STDCM-${codeNumber}.pdf`}
            >
              {t('stdcmSimulationReport')}
            </PDFDownloadLink>
          </button>
        </div>
      </div>
    </main>
  );
};

export default StcdmResultsV2;
