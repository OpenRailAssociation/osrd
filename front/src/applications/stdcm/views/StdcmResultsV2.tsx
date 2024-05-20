import React from 'react';

import { PDFDownloadLink } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import type { RollingStockWithLiveries } from 'common/api/osrdEditoastApi';

import SimulationReportSheetV2 from '../components/SimulationReportSheetV2';
import type { StdcmV2SuccessResponse } from '../types';
import { generateCodeNumber } from '../utils';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type StcdmResultsProps = {
  mapCanvas?: string;
  stdcmResults: StdcmV2SuccessResponse;
  pathProperties?: ManageTrainSchedulePathProperties;
  rollingStockData: RollingStockWithLiveries;
  speedLimitByTag?: string;
  creationDate?: Date;
};

const codeNumber = generateCodeNumber();

// TODO TS2 : Adapt StdcmResult to trainSchedule v2 (SpaceTimeChart and SpeedSpaceChart)

const StcdmResultsV2 = ({
  mapCanvas,
  stdcmResults,
  pathProperties,
  rollingStockData,
  speedLimitByTag,
  creationDate,
}: StcdmResultsProps) => {
  const { t } = useTranslation(['translation', 'stdcm']);

  return (
    <main className="osrd-config-mastcontainer" style={{ height: '115vh' }}>
      <div className="osrd-simulation-container mb-2 simulation-results">
        <div className="osrd-config-item-container">
          <button className="btn d-flex align-items-center mb-1 font-weight-bold" type="button">
            <PDFDownloadLink
              document={
                <SimulationReportSheetV2
                  stdcmData={stdcmResults}
                  pathProperties={pathProperties}
                  rollingStockData={rollingStockData}
                  speedLimitByTag={speedLimitByTag}
                  simulationReportSheetNumber={codeNumber}
                  mapCanvas={mapCanvas}
                  creationDate={creationDate}
                />
              }
              fileName={`STDCM-${codeNumber}.pdf`}
            >
              {t('stdcm:stdcmSimulationReport')}
            </PDFDownloadLink>
          </button>
        </div>
      </div>
    </main>
  );
};

export default StcdmResultsV2;
