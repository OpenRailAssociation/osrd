import React, { useEffect, useState } from 'react';

import { Button } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

import type {
  StdcmResultsOperationalPointsList,
  StdcmV2SuccessResponse,
} from 'applications/stdcm/types';
import { getStopDurationTime } from 'applications/stdcm/utils';

type SimulationTableProps = {
  stdcmData: StdcmV2SuccessResponse;
  setIsSimulationSelected: (simulationSelected: boolean) => void;
  isSimulationSelected: boolean;
  operationalPointsList: StdcmResultsOperationalPointsList;
};

const StcdmResultsTable = ({
  stdcmData,
  setIsSimulationSelected,
  isSimulationSelected,
  operationalPointsList,
}: SimulationTableProps) => {
  const { t } = useTranslation(['stdcm-simulation-report-sheet', 'stdcm']);

  const [showAllOP, setShowAllOP] = useState(false);

  const selectSimulation = () => {
    setIsSimulationSelected(true);
  };

  useEffect(() => {
    setIsSimulationSelected(false);
  }, [stdcmData]);

  const handleShowAllClick = () => {
    setShowAllOP((prevState) => !prevState);
  };

  return (
    <div className="table-container">
      <table className="table-results">
        <thead>
          <th aria-label="line-count" />
          <th>{t('operationalPoint')}</th>
          <th>{t('code')}</th>
          <th>{t('endStop')}</th>
          <th>{t('passageStop')}</th>
          <th>{t('startStop')}</th>
          <th className="weight">{t('weight')}</th>
          <th>{t('refEngine')}</th>
        </thead>
        <tbody className="table-results">
          {operationalPointsList.map((step, index) => {
            const isFirstStep = index === 0;
            const isLastStep = index === operationalPointsList.length - 1;
            const prevStep = operationalPointsList[index - 1];
            const shouldRenderRow = isFirstStep || step.duration > 0 || isLastStep;
            if (showAllOP || shouldRenderRow) {
              return (
                <tr key={index}>
                  <td
                    className="index"
                    style={{
                      fontWeight: isFirstStep || isLastStep ? 600 : 'normal',
                      color: isFirstStep || isLastStep ? '' : 'rgb(121, 118, 113)',
                    }}
                  >
                    {index + 1}
                  </td>
                  <td>
                    {!isFirstStep &&
                    !isLastStep &&
                    step.name === prevStep.name &&
                    step.duration === 0
                      ? '='
                      : step.name || 'Unknown'}
                  </td>
                  <td className="ch">{step.ch}</td>
                  <td className="stop">{isLastStep || step.duration > 0 ? step.time : ''}</td>
                  <td className="stop">
                    <div
                      className={
                        step.duration !== 0 && !isLastStep ? 'stop-with-duration ml-n2' : 'stop'
                      }
                      style={{
                        width: `${step.duration < 600 && step.duration >= 60 ? 55 : 65}px`,
                      }}
                    >
                      {
                        // eslint-disable-next-line no-nested-ternary
                        !isFirstStep && !isLastStep
                          ? step.duration !== 0
                            ? getStopDurationTime(step.duration)
                            : step.time
                          : ''
                      }
                    </div>
                  </td>
                  <td className="stop">
                    {isFirstStep || step.duration > 0 ? step.stopEndTime : ''}
                  </td>
                  <td className="weight" style={{ color: isLastStep ? '#797671' : '#312E2B' }}>
                    {!isFirstStep && !isLastStep
                      ? '='
                      : `${Math.floor(stdcmData.rollingStock.mass / 1000)} t`}
                  </td>
                  <td style={{ color: isLastStep ? '#797671' : '#312E2B' }}>
                    {!isFirstStep && !isLastStep ? '=' : stdcmData.rollingStock.metadata?.reference}
                  </td>
                </tr>
              );
            }
            return null;
          })}
        </tbody>
      </table>
      <div className="display-all" style={!isSimulationSelected ? {} : { borderRadius: '0' }}>
        <div className="button-display-all-PR">
          <Button
            variant="Normal"
            label={
              showAllOP
                ? t('stdcm:simulation.results.displayMain')
                : t('stdcm:simulation.results.displayAll')
            }
            onClick={handleShowAllClick}
          />
        </div>
        <div className="button-get-simulation">
          {!isSimulationSelected ? (
            <Button
              label={t('stdcm:simulation.results.selectThisSimulation')}
              onClick={selectSimulation}
              isDisabled={isSimulationSelected}
            />
          ) : (
            <div className="selected-simulation">
              {t('stdcm:simulation.results.simulationSelected')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StcdmResultsTable;
