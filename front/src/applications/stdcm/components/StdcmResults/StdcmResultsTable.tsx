import { Fragment, useState, type JSX } from 'react';

import { Button } from '@osrd-project/ui-core';
import { ArrowRight, CheckCircle, Container } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';

import type {
  ConsistData,
  StdcmResultsOperationalPoint,
  StdcmSimulationInputs,
  StdcmSuccessResponse,
} from 'applications/stdcm/types';
import { getStopDurationTime } from 'modules/SimulationReportSheet/utils/formatSimulationReportSheet';
import { retainSimulation } from 'reducers/osrdconf/stdcmConf';
import type { StdcmViaPathStep } from 'reducers/osrdconf/types';

type SimulationTableProps = {
  stdcmData: StdcmSuccessResponse;
  consist: StdcmSimulationInputs['consist'];
  isSimulationRetained: boolean;
  operationalPointsList: StdcmResultsOperationalPoint[];
  simulationIndex: number;
};

const StdcmResultsTable = ({
  stdcmData,
  consist,
  isSimulationRetained,
  operationalPointsList,
  simulationIndex,
}: SimulationTableProps) => {
  const { t } = useTranslation('stdcm');
  const dispatch = useDispatch();
  const intermediatePathSteps = stdcmData.simulationPathSteps.slice(1, -1) as StdcmViaPathStep[];
  const lastDefinedConsistChange = intermediatePathSteps
    .toReversed()
    .find((pathStep) => pathStep.consistChange)?.consistChange;

  const [showAllOP, setShowAllOP] = useState(false);
  const toggleShowAllOP = () => setShowAllOP((prevState) => !prevState);

  const onRetainSimulation = () => {
    dispatch(retainSimulation(simulationIndex));
  };

  const operationalPointRows: JSX.Element[] = [];

  let currentConsist: ConsistData = {
    totalLength: consist.totalLength!,
    totalMass: consist.totalMass!,
  };

  for (const [index, step] of operationalPointsList.entries()) {
    const isFirstStep = index === 0;
    const isLastStep = index === operationalPointsList.length - 1;
    const prevStep = operationalPointsList[index - 1];
    const isRequestedPathStep = stdcmData.simulationPathSteps.some(
      ({ operationalPoint }) => operationalPoint && operationalPoint.id === step.opId
    );
    const shouldRenderRow =
      isFirstStep || isRequestedPathStep || isLastStep || step.duration !== null;
    const isPathStep = isFirstStep || isLastStep || isRequestedPathStep;
    const isNotExtremity = !isFirstStep && !isLastStep;

    const extremityStepMass =
      (isLastStep && lastDefinedConsistChange?.totalMass) || consist.totalMass!;
    const displayedMass = isNotExtremity ? step.consistChange?.totalMass : extremityStepMass;

    const extremityRollingStock =
      (isLastStep && lastDefinedConsistChange?.rollingStockName) || consist.tractionEngine!.name;
    const displayedRollingStock = isNotExtremity
      ? step.consistChange?.rollingStockName
      : extremityRollingStock;

    const previousConsist = currentConsist;
    currentConsist = step.consistChange ? step.consistChange : currentConsist;

    if (showAllOP || shouldRenderRow) {
      operationalPointRows.push(
        <Fragment key={`op-list-row-${index}`}>
          <tr className={cx({ isPathStep })}>
            <td className={cx('index', { 'muted-text': !isPathStep })}>{index + 1}</td>
            <td className="name">
              {isNotExtremity &&
              !isRequestedPathStep &&
              step.name === prevStep.name &&
              step.duration === null
                ? '='
                : step.name || t('reportSheet.unknown')}
            </td>
            <td className={cx('ch', { 'muted-text': !isPathStep })}>{step.secondaryCode}</td>
            <td className="stop">{isLastStep || step.duration !== null ? step.time : ''}</td>
            <td className="stop">
              {isNotExtremity && (
                <div className={step.duration !== null ? 'stop-with-duration ml-n2' : 'stop'}>
                  {step.duration !== null ? getStopDurationTime(step.duration) : step.time}
                </div>
              )}
            </td>
            <td className="stop">
              {isFirstStep || step.duration !== null ? step.stopEndTime : ''}
            </td>
            <td className={cx('weight', { 'muted-text': !isFirstStep })}>
              {displayedMass ? `${displayedMass}t` : '='}
            </td>
            <td className={cx('ref', { 'muted-text': !isFirstStep })}>
              {displayedRollingStock ?? '='}
            </td>
          </tr>
          {step.consistChange && (
            <tr>
              <td className="index">
                <Container />
              </td>
              <td colSpan={8} data-testid="consist-change">
                <p className="consist-change-label">{t('consist.consistChange')}</p>
                <p>
                  {t('consist.tonnage')} ({previousConsist.totalMass}t <ArrowRight />{' '}
                  {step.consistChange.totalMass}t), {t('consist.length')} (
                  {previousConsist.totalLength}m <ArrowRight /> {step.consistChange.totalLength}m)
                </p>
              </td>
            </tr>
          )}
        </Fragment>
      );
    }
  }

  return (
    <div className="stdcm-result-table-container">
      <table data-testid="table-results" className="table-results">
        <thead>
          <tr>
            <th aria-label="line-count" />
            <th>{t('reportSheet.operationalPoint')}</th>
            <th>{t('reportSheet.code')}</th>
            <th className="head-stop">{t('reportSheet.endStop')}</th>
            <th className="head-stop">{t('reportSheet.passageStop')}</th>
            <th className="head-stop">{t('reportSheet.startStop')}</th>
            <th className="weight">{t('reportSheet.weight')}</th>
            <th>{t('reportSheet.refEngine')}</th>
          </tr>
        </thead>
        <tbody>{operationalPointRows}</tbody>
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
            <div className="selected-simulation success-message">
              {t('simulation.results.simulationSelected')}
              <CheckCircle className="check-circle" variant="fill" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StdcmResultsTable;
