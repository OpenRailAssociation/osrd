import React from 'react';

import { useTranslation } from 'react-i18next';

import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import type { SimulationReportSheetProps, StdcmV2SuccessResponse } from 'applications/stdcm/types';
import { getOperationalPointsWithTimes } from 'applications/stdcm/utils';
import type { RollingStockWithLiveries } from 'common/api/osrdEditoastApi';

type SimulationTableProps = {
  stdcmData: StdcmV2SuccessResponse;
  pathProperties?: ManageTrainSchedulePathProperties;
  rollingStockData: RollingStockWithLiveries;
};

const StcdmTableResults = ({
  stdcmData,
  pathProperties,
  rollingStockData,
}: SimulationTableProps) => {
  const { t } = useTranslation('stdcm');
  let renderedIndex = 0;

  const simulationReport: SimulationReportSheetProps = {
    stdcmData,
    pathProperties,
    rollingStockData,
  };

  const opList = getOperationalPointsWithTimes(simulationReport);

  return (
    <div className="table-container">
      <table className="table-results">
        <thead className="thead">
          <th aria-label="line-count" />
          <th>{t('operationalPoint')}</th>
          <th>{t('code')}</th>
          <th>{t('endStop')}</th>
          <th>{t('passageStop')}</th>
          <th>{t('startStop')}</th>
          <th>{t('weight')}</th>
          <th>{t('refEngine')}</th>
        </thead>
        <tbody>
          {opList.map((step, index) => {
            const isFirstStep = index === 0;
            const isLastStep = index === opList.length - 1;
            const prevStep = opList[index - 1];
            return (
              <tr key={index} className="tbody">
                <td className="index">{index + 1}</td>
                <td className="op">
                  {' '}
                  {!isFirstStep && !isLastStep && step.name === prevStep.name
                    ? '='
                    : step.name || 'Unknown'}
                </td>
                <td className="ch">{step.ch}</td>
                <td className="td">{isLastStep ? step.time : ''}</td>
                <td className="">{isFirstStep || isLastStep ? '' : step.time}</td>
                <td className="start">{isFirstStep ? step.departureTime : ''}</td>
                <td className="td">{isFirstStep || isLastStep ? t('serviceStop') : ''}</td>
                <td className="td">
                  {!isFirstStep ? '=' : `${Math.floor(rollingStockData.mass / 1000)} t`}
                </td>
                <td className="td"> {!isFirstStep ? '=' : rollingStockData.metadata?.reference}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default StcdmTableResults;
