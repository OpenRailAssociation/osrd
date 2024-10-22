import { useState } from 'react';

import { Button } from '@osrd-project/ui-core';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type {
  StdcmResultsOperationalPointsList,
  StdcmV2SuccessResponse,
} from 'applications/stdcm/types';
import { getStopDurationTime } from 'applications/stdcm/utils/formatSimulationReportSheet';

type SimulationTableProps = {
  stdcmData: StdcmV2SuccessResponse;
  isSimulationRetained: boolean;
  operationalPointsList: StdcmResultsOperationalPointsList;
  onRetainSimulation: () => void;
};

const StcdmResultsTable = ({
  stdcmData,
  onRetainSimulation,
  isSimulationRetained,
  operationalPointsList,
}: SimulationTableProps) => {
  const { t } = useTranslation(['stdcm-simulation-report-sheet', 'stdcm']);

  const [showAllOP, setShowAllOP] = useState(false);
  const toggleShowAllOP = () => setShowAllOP((prevState) => !prevState);

  console.log('hello', operationalPointsList);

  return (
    <div className="table-container">
      <table className="table-results">
        <thead>
          <tr>
            <th aria-label="line-count" />
            <th>{t('operationalPoint')}</th>
            <th>{t('code')}</th>
            <th>{t('endStop')}</th>
            <th>{t('passageStop')}</th>
            <th>{t('startStop')}</th>
            <th className="weight">{t('weight')}</th>
            <th>{t('refEngine')}</th>
          </tr>
        </thead>
        <tbody className="table-results">
          {operationalPointsList.map((step, index) => {
            const isFirstStep = index === 0;
            const isLastStep = index === operationalPointsList.length - 1;
            const prevStep = operationalPointsList[index - 1];
            const isRequestedPathStep = stdcmData.simulationPathSteps.some(
              ({ location }) =>
                location &&
                location.name === step.name &&
                'secondary_code' in location &&
                location.secondary_code === step.ch
            );
            const shouldRenderRow = isFirstStep || isRequestedPathStep || isLastStep;
            const isPathStep =
              isFirstStep || isLastStep || (isRequestedPathStep && step.duration === 0);
            const isNotExtremity = !isFirstStep && !isLastStep;
            console.log({ shouldRenderRow });
            if (showAllOP || shouldRenderRow) {
              return (
                <tr key={index}>
                  <td
                    className="index"
                    style={{
                      fontWeight: isPathStep ? 600 : 'normal',
                      color: isPathStep ? '' : 'rgb(121, 118, 113)',
                    }}
                  >
                    {index + 1}
                  </td>
                  <td style={{ color: 'rgb(49, 46, 43)' }}>
                    {isNotExtremity &&
                    !isRequestedPathStep &&
                    step.name === prevStep.name &&
                    !isRequestedPathStep &&
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
                        isNotExtremity || !isRequestedPathStep
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
                  <td className="weight" style={{ color: !isFirstStep ? '#797671' : '#312E2B' }}>
                    {isNotExtremity ? '=' : `${Math.floor(stdcmData.rollingStock.mass / 1000)}t`}
                  </td>
                  <td style={{ color: !isFirstStep ? '#797671' : '#312E2B' }}>
                    {isNotExtremity ? '=' : stdcmData.rollingStock.metadata?.reference}
                  </td>
                </tr>
              );
            }
            return null;
          })}
        </tbody>
      </table>
      <div className={cx('results-buttons', { 'simulation-retained': isSimulationRetained })}>
        <div className="button-display-all-PR">
          <Button
            variant="Normal"
            label={
              showAllOP
                ? t('stdcm:simulation.results.displayMain')
                : t('stdcm:simulation.results.displayAll')
            }
            onClick={toggleShowAllOP}
          />
        </div>
        <div className="button-get-simulation">
          {!isSimulationRetained ? (
            <Button
              label={t('stdcm:simulation.results.retainThisSimulation')}
              onClick={onRetainSimulation}
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
