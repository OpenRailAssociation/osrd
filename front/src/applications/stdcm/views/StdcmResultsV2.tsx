import React, { useMemo, useState } from 'react';

import { PDFDownloadLink } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import { LoaderFill } from 'common/Loaders';
import SpaceTimeChartV2 from 'modules/simulationResult/components/SpaceTimeChart/SpaceTimeChartV2';
import SpeedSpaceChartV2 from 'modules/simulationResult/components/SpeedSpaceChart/SpeedSpaceChartV2';
import type { TimeScaleDomain } from 'modules/simulationResult/types';

import SimulationReportSheetV2 from '../components/SimulationReportSheetV2';
import { STDCM_TRAIN_ID } from '../consts';
import type { StdcmV2Results } from '../types';
import {
  generateCodeNumber,
  getOperationalPointsWithTimes,
} from '../utils/formatSimulationReportSheet';

type StcdmResultsProps = {
  mapCanvas?: string;
  stdcmV2Results: StdcmV2Results;
  pathProperties?: ManageTrainSchedulePathProperties;
};

const codeNumber = generateCodeNumber();

// TODO TS2 : Adapt StdcmResult to trainSchedule v2 (SpaceTimeChart and SpeedSpaceChart)

const StcdmResultsV2 = ({ mapCanvas, stdcmV2Results, pathProperties }: StcdmResultsProps) => {
  const { t } = useTranslation(['stdcm']);
  const [spaceTimeChartHeight, setSpaceTimeChartHeight] = useState(450);
  const [speedSpaceChartHeight, setSpeedSpaceChartHeight] = useState(250);

  const [timeScaleDomain, setTimeScaleDomain] = useState<TimeScaleDomain>({
    range: undefined,
    source: undefined,
  });

  const {
    stdcmResponse,
    speedSpaceChartData,
    spaceTimeData,
    infraId,
    selectedTrainSchedule,
    dispatchUpdateSelectedTrainId,
    setSpaceTimeData,
  } = stdcmV2Results;

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
          <div className="chart-container mt-2" style={{ height: `${spaceTimeChartHeight}px` }}>
            {spaceTimeData.length ? (
              <SpaceTimeChartV2
                infraId={infraId}
                inputSelectedTrain={selectedTrainSchedule}
                trainIdUsedForProjection={STDCM_TRAIN_ID}
                simulation={spaceTimeData}
                initialHeight={spaceTimeChartHeight}
                onSetBaseHeight={setSpaceTimeChartHeight}
                dispatchUpdateSelectedTrainId={dispatchUpdateSelectedTrainId}
                setTrainSpaceTimeData={setSpaceTimeData}
                timeScaleDomain={timeScaleDomain}
                setTimeScaleDomain={setTimeScaleDomain}
                deactivateChartSynchronization={selectedTrainSchedule.id !== STDCM_TRAIN_ID}
              />
            ) : (
              <LoaderFill />
            )}
          </div>
        </div>
        <div className="osrd-simulation-container mb-2">
          <p className="mt-2 mb-3 ml-4 font-weight-bold">{t('spaceSpeedGraphic')}</p>
          <div className="chart-container mt-2" style={{ height: `${speedSpaceChartHeight}px` }}>
            {speedSpaceChartData ? (
              <SpeedSpaceChartV2
                initialHeight={speedSpaceChartHeight}
                onSetChartBaseHeight={setSpeedSpaceChartHeight}
                trainRollingStock={speedSpaceChartData.rollingStock}
                trainSimulation={stdcmResponse.simulation}
                selectedTrainPowerRestrictions={speedSpaceChartData.formattedPowerRestrictions}
                pathProperties={speedSpaceChartData.formattedPathProperties}
                departureTime={speedSpaceChartData.departureTime}
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
                <SimulationReportSheetV2
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
