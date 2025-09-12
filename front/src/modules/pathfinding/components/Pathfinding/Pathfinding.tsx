import { Alert, CheckCircle, Stop } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { isEqual } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useManageTimetableItemContext } from 'applications/operationalStudies/hooks/useManageTimetableItemContext';
import InfraLoadingState from 'applications/operationalStudies/views/Scenario/components/InfraLoadingState';
import infraLogo from 'assets/pictures/components/tracks.svg';
import { Spinner } from 'common/Loaders';
import { isPathStepInvalid } from 'modules/pathfinding/utils';
import {
  getPathSteps,
  getOrigin,
  getDestination,
} from 'reducers/osrdconf/operationalStudiesConf/selectors';
import { conditionalStringConcat, formatKmValue } from 'utils/strings';

import InfraError from './InfraError';

const Pathfinding = ({ rollingStockId }: { rollingStockId: number | undefined }) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTimetableItem' });

  const pathSteps = useSelector(getPathSteps);
  const hasInvalidPathStep = pathSteps.some((pathStep) => isPathStepInvalid(pathStep));
  const origin = useSelector(getOrigin, isEqual);
  const destination = useSelector(getDestination, isEqual);

  const { pathProperties, pathfindingState, workerStatus } = useManageTimetableItemContext();

  const missingElements = conditionalStringConcat([
    [!origin, t('origin')],
    [!destination, t('destination')],
    [!rollingStockId, t('rollingstock')],
  ]);

  const isPathFindingActive = Object.values(pathfindingState).every(
    (state) => state === false || state === ''
  );

  return (
    <div className="pathfinding-state-main-container flex-grow-1">
      {workerStatus !== 'READY' && (
        <div className="content infra-loading">
          <img src={infraLogo} alt="Infra logo" className="infra-logo" />
          <div>{t('infraLoading')}</div>
          <InfraLoadingState />
        </div>
      )}

      {workerStatus === 'ERROR' && <InfraError />}

      {!pathfindingState.error &&
        !pathfindingState.isRunning &&
        pathfindingState.isDone &&
        origin &&
        destination &&
        !hasInvalidPathStep && (
          <div className="content pathfinding-done">
            <span className="lead" data-testid="result-pathfinding-done">
              <CheckCircle />
            </span>
            <span className="flex-grow-1">{t('pathfindingDone')}</span>
            <small className="text-secondary" data-testid="result-pathfinding-distance">
              {destination.positionOnPath &&
                formatKmValue(destination.positionOnPath, 'millimeters')}
            </small>
          </div>
        )}

      {!pathProperties && isPathFindingActive ? (
        <div
          data-testid="pathfinding-no-state"
          className={cx('content pathfinding-none', { 'mt-2': workerStatus !== 'READY' })}
        >
          {t('pathfindingNoState')}
        </div>
      ) : (
        <>
          {(pathfindingState.error || hasInvalidPathStep) && (
            <div
              className={cx('content pathfinding-error', {
                'mt-2': workerStatus !== 'READY',
              })}
            >
              <span className="lead">
                <Stop />
              </span>
              <span className="flex-grow-1">
                {pathfindingState.error
                  ? t('pathfindingError', { errorMessage: pathfindingState.error })
                  : t('invalidTimetableItemStep')}
              </span>
            </div>
          )}
          {pathfindingState.isMissingParam && (
            <div className="content missing-params">
              <span className="lead">
                <Alert />
              </span>
              <span data-testid="missing-params-info" className="flex-grow-1">
                {t('pathfindingMissingParams', { missingElements })}
              </span>
            </div>
          )}
          {pathfindingState.isRunning && (
            <div className="content pathfinding-loading">
              <span className="lead">
                <Spinner />
              </span>
              <span data-testid="pathfinding-in-progress" className="flex-grow-1">
                {t('pathfindingInProgress')}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Pathfinding;
