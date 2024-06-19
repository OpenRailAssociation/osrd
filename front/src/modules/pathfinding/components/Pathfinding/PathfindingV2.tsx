import React from 'react';

import { Alert, CheckCircle, Stop } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { isEqual } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import InfraLoadingState from 'applications/operationalStudies/components/Scenario/InfraLoadingState';
import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import infraLogo from 'assets/pictures/components/tracks.svg';
import { Spinner } from 'common/Loaders';
import { useOsrdConfSelectors } from 'common/osrdContext';
import { usePathfindingV2 } from 'modules/pathfinding/hook/usePathfinding';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import { conditionalStringConcat, formatKmValue } from 'utils/strings';

import { InfraHardError, InfraSoftError } from './InfraError';

type PathfindingProps = {
  pathProperties?: ManageTrainSchedulePathProperties;
  setPathProperties: (pathProperties?: ManageTrainSchedulePathProperties) => void;
};

const Pathfinding = ({ pathProperties, setPathProperties }: PathfindingProps) => {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);

  const { getOriginV2, getDestinationV2 } = useOsrdConfSelectors();
  const origin = useSelector(getOriginV2, isEqual);
  const destination = useSelector(getDestinationV2, isEqual);
  const { rollingStock } = useStoreDataForRollingStockSelector();

  const {
    pathfindingState,
    infraInfos: { infra, reloadCount },
  } = usePathfindingV2(setPathProperties, pathProperties);

  const missingElements = conditionalStringConcat([
    [!origin, t('origin')],
    [!destination, t('destination')],
    [!rollingStock, t('rollingstock')],
  ]);

  const isPathFindingActive = Object.values(pathfindingState).every(
    (state) => state === false || state === ''
  );

  return (
    <div className="pathfinding-state-main-container flex-grow-1">
      {infra && infra.state !== 'CACHED' && (
        <div className="content infra-loading">
          <img src={infraLogo} alt="Infra logo" className="infra-logo" />
          <div>{t('infraLoading')}</div>
          <InfraLoadingState infra={infra} />
        </div>
      )}

      {infra && infra.state === 'TRANSIENT_ERROR' && <InfraSoftError reloadCount={reloadCount} />}

      {infra && infra.state === 'ERROR' && <InfraHardError />}

      {!pathfindingState.error &&
        !pathfindingState.running &&
        pathfindingState.done &&
        origin &&
        destination && (
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
          className={cx('content pathfinding-none', { 'mt-2': infra && infra.state !== 'CACHED' })}
        >
          {t('pathfindingNoState')}
        </div>
      ) : (
        <>
          {pathfindingState.error && (
            <div
              className={cx('content pathfinding-error', {
                'mt-2': infra && infra.state !== 'CACHED',
              })}
            >
              <span className="lead">
                <Stop />
              </span>
              <span className="flex-grow-1">
                {t('pathfindingError', { errorMessage: t(pathfindingState.error) })}
              </span>
            </div>
          )}
          {pathfindingState.missingParam && (
            <div className="content missing-params">
              <span className="lead">
                <Alert />
              </span>
              <span className="flex-grow-1">
                {t('pathfindingMissingParams', { missingElements })}
              </span>
            </div>
          )}
          {pathfindingState.running && (
            <div className="content pathfinding-loading">
              <span className="lead">
                <Spinner />
              </span>
              <span className="flex-grow-1">{t('pathfindingInProgress')}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Pathfinding;
