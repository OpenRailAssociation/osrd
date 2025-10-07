import { useState } from 'react';

import { Button } from '@osrd-project/ui-core';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';

import type {
  StdcmResultsOperationalPoint,
  StdcmSimulationInputs,
  StdcmSuccessResponse,
} from 'applications/stdcm/types';
import { getStopDurationTime } from 'modules/SimulationReportSheet/utils/formatSimulationReportSheet';
import { retainSimulation } from 'reducers/osrdconf/stdcmConf';

type SimulationTableProps = {
  stdcmData: StdcmSuccessResponse;
  consist: StdcmSimulationInputs['consist'];
  isSimulationRetained: boolean;
  operationalPointsList: StdcmResultsOperationalPoint[];
  simulationIndex: number;
};

const StcdmResultsTable = ({
  stdcmData,
  consist,
  isSimulationRetained,
  operationalPointsList,
  simulationIndex,
}: SimulationTableProps) => {
  const { t } = useTranslation('stdcm');
  const dispatch = useDispatch();

  const [showAllOP, setShowAllOP] = useState(false);
  const toggleShowAllOP = () => setShowAllOP((prevState) => !prevState);

  const onRetainSimulation = () => {
    dispatch(retainSimulation(simulationIndex));
  };

  return (
    <div className="table-container">
      <table data-testid="table-results" className="table-results">
        <thead>
          <tr>
            <th aria-label="line-count" />
            <th>{t('reportSheet.operationalPoint')}</th>
            <th>{t('reportSheet.code')}</th>
            <th>{t('reportSheet.track')}</th>
            <th className="head-stop">{t('reportSheet.endStop')}</th>
            <th className="head-stop">{t('reportSheet.passageStop')}</th>
            <th className="head-stop">{t('reportSheet.startStop')}</th>
            <th className="weight">{t('reportSheet.weight')}</th>
            <th>{t('reportSheet.refEngine')}</th>
          </tr>
        </thead>
        <tbody>
          {operationalPointsList.map((step, index) => {
            const isFirstStep = index === 0;
            const isLastStep = index === operationalPointsList.length - 1;
            const prevStep = operationalPointsList[index - 1];
            const isRequestedPathStep = stdcmData.simulationPathSteps.some(
              ({ location }) =>
                location && location.name === step.name && location.secondary_code === step.ch
            );
            const shouldRenderRow =
              isFirstStep || isRequestedPathStep || isLastStep || step.duration !== null;
            const isPathStep =
              isFirstStep || isLastStep || (isRequestedPathStep && step.duration === null);
            const isNotExtremity = !isFirstStep && !isLastStep;

            const mass = consist?.totalMass ?? stdcmData.rollingStock.mass / 1000;

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
                  <td className="name" style={{ color: 'rgb(49, 46, 43)' }}>
                    {isNotExtremity &&
                    !isRequestedPathStep &&
                    step.name === prevStep.name &&
                    !isRequestedPathStep &&
                    step.duration === null
                      ? '='
                      : step.name || t('reportSheet.unknown')}
                  </td>
                  <td className="ch">{step.ch}</td>
                  <td className="track">{step.trackName}</td>
                  <td className="stop">{isLastStep || step.duration !== null ? step.time : ''}</td>
                  <td className="stop">
                    <div
                      className={
                        step.duration !== null && !isLastStep ? 'stop-with-duration ml-n2' : 'stop'
                      }
                    >
                      {isNotExtremity || !isRequestedPathStep
                        ? step.duration !== null
                          ? getStopDurationTime(step.duration)
                          : step.time
                        : ''}
                    </div>
                  </td>
                  <td className="stop">
                    {isFirstStep || step.duration !== null ? step.stopEndTime : ''}
                  </td>
                  <td className="weight" style={{ color: !isFirstStep ? '#797671' : '#312E2B' }}>
                    {isNotExtremity ? '=' : `${Math.floor(mass)}t`}
                  </td>
                  <td className="ref" style={{ color: !isFirstStep ? '#797671' : '#312E2B' }}>
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
            dataTestID="all-vias-button"
            variant="Normal"
            label={
              showAllOP ? t('simulation.results.displayMain') : t('simulation.results.displayAll')
            }
            onClick={toggleShowAllOP}
          />
        </div>
        <div className="button-get-simulation">
          {!isSimulationRetained ? (
            <Button
              dataTestID="retain-simulation-button"
              label={t('simulation.results.retainThisSimulation')}
              onClick={onRetainSimulation}
            />
          ) : (
            <div className="selected-simulation">{t('simulation.results.simulationSelected')}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StcdmResultsTable;
