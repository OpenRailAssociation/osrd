import React from 'react';

import { useTranslation } from 'react-i18next';

import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import type { StdcmV2SuccessResponse } from 'applications/stdcm/types';
import type { RollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import { Map } from 'modules/trainschedule/components/ManageTrainSchedule';
import { formatDateToString } from 'utils/date';

import StdcmTableResults from '../components/StdcmTableResults';

type StcdmResultsV2Props = {
  stdcmData: StdcmV2SuccessResponse;
  pathProperties?: ManageTrainSchedulePathProperties;
  rollingStockData: RollingStockWithLiveries;
  creationDate?: Date;
};

const StcdmViewResultsV2 = ({
  stdcmData,
  pathProperties,
  rollingStockData,
  creationDate,
}: StcdmResultsV2Props) => {
  const { t } = useTranslation('stdcm');
  const date = creationDate && t('formattedCreationDate', formatDateToString(creationDate));

  return (
    <main className="stdcm-v2-results">
      <div className="simuation-banner">
        <div>Simulation n°1</div>
        <div className="creation-date">{date}</div>
      </div>
      <div className="simuation-results">
        <StdcmTableResults
          stdcmData={stdcmData}
          pathProperties={pathProperties}
          rollingStockData={rollingStockData}
        />
        <div className="osrd-config-item-container osrd-config-item-container-map map-results">
          <Map hideAttribution />
        </div>
      </div>
    </main>
  );
};

export default StcdmViewResultsV2;
