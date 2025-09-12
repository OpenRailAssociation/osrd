import { Button } from '@osrd-project/ui-core';
import { Alert } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { Infra, WorkerStatus } from 'common/api/osrdEditoastApi';

import useStaticPathfinding from '../hooks/useStaticPathfinding';
import { StdcmConfigErrorTypes, type StdcmConfigErrors } from '../types';

const SHORT_TEXT_ERRORS = [StdcmConfigErrorTypes.INFRA_NOT_LOADED];

type StdcmWarningBoxProps = {
  infra?: Infra;
  workerStatus: WorkerStatus;
  errorInfos: StdcmConfigErrors;
  removeOriginArrivalTime: () => void;
  removeDestinationArrivalTime: () => void;
};

const StdcmWarningBox = ({
  infra,
  workerStatus,
  errorInfos: { errorType, errorDetails },
  removeOriginArrivalTime,
  removeDestinationArrivalTime,
}: StdcmWarningBoxProps) => {
  const { t } = useTranslation('stdcm');

  const hasInvalidFields = (errorDetails?.invalidFields?.length ?? 0) > 0;
  const hasMissingFields = (errorDetails?.missingFields?.length ?? 0) > 0;
  const hasRouteErrors = (errorDetails?.routeErrors?.length ?? 0) > 0;

  const { pathfinding, isPathFindingLoading: _ } = useStaticPathfinding(workerStatus, infra);
  const hasIncompatibleConstraints =
    pathfinding?.status === 'failure' &&
    pathfinding.failed_status === 'pathfinding_not_found' &&
    pathfinding.error_type === 'incompatible_constraints';

  const electricalConstraintCount = hasIncompatibleConstraints
    ? pathfinding?.incompatible_constraints.incompatible_electrification_ranges.length
    : 0;
  const loadingGaugeConstraintCount = hasIncompatibleConstraints
    ? pathfinding?.incompatible_constraints.incompatible_gauge_ranges.length
    : 0;
  const signalingSystemConstraintCount = hasIncompatibleConstraints
    ? pathfinding?.incompatible_constraints.incompatible_signaling_system_ranges.length
    : 0;
  const errorConstraintCount =
    electricalConstraintCount + loadingGaugeConstraintCount + signalingSystemConstraintCount;

  const renderIncompatibleConstraintWarning = (
    constraintType:
      | 'incompatibleElectrical'
      | 'incompatibleLoadingGauge'
      | 'incompatibleSignalingSystem',
    count: number
  ) => {
    if (count === 0) return null;

    return (
      <div>{t(`stdcmErrors.incompatibleConstraintsDetails.${constraintType}`, { count })}</div>
    );
  };

  return (
    <div data-testid="warning-box" className="warning-box">
      <span>
        <Alert variant="fill" size="lg" />
      </span>

      {hasRouteErrors && (
        <>
          <p className={cx('mb-0 text-justify', { 'mt-3': hasInvalidFields || hasMissingFields })}>
            {t('stdcmErrors.routeErrors.global')}
          </p>
          <div>
            {errorDetails?.routeErrors!.map((error) => (
              <div key={error}>&bull;&nbsp;{t(`stdcmErrors.routeErrors.${error}`)}</div>
            ))}
          </div>
        </>
      )}

      {errorDetails?.routeErrors?.includes(StdcmConfigErrorTypes.BOTH_POINT_SCHEDULED) && (
        <div className="stdcm-warning-buttons">
          <Button
            type="button"
            onClick={removeDestinationArrivalTime}
            label={errorDetails.originTime!}
          />
          <Button
            type="button"
            onClick={removeOriginArrivalTime}
            label={errorDetails.destinationTime!}
          />
        </div>
      )}

      {!hasInvalidFields && !hasMissingFields && !hasRouteErrors && (
        <div
          className={cx({
            'text-center': SHORT_TEXT_ERRORS.includes(errorType),
            'text-justify': !SHORT_TEXT_ERRORS.includes(errorType),
          })}
        >
          {!hasIncompatibleConstraints && t(`stdcmErrors.${errorType}`)}
          {hasIncompatibleConstraints && (
            <div>
              {t(`stdcmErrors.incompatibleConstraints`, { count: errorConstraintCount })}
              {renderIncompatibleConstraintWarning(
                'incompatibleElectrical',
                electricalConstraintCount
              )}
              {renderIncompatibleConstraintWarning(
                'incompatibleLoadingGauge',
                loadingGaugeConstraintCount
              )}
              {renderIncompatibleConstraintWarning(
                'incompatibleSignalingSystem',
                signalingSystemConstraintCount
              )}
            </div>
          )}
        </div>
      )}

      {hasInvalidFields && (
        <>
          <p className={cx('mb-0 text-justify', { 'pt-3': hasRouteErrors })}>
            {t('stdcmErrors.invalidInformations')}
          </p>
          <div>
            {errorDetails?.invalidFields!.map((field) => (
              <div key={field.fieldName}>
                &bull;&nbsp;{t(`stdcmErrors.invalidFields.${field.fieldName}`)}
              </div>
            ))}
          </div>
        </>
      )}

      {hasMissingFields && (
        <>
          <p className={cx('mb-0 text-justify', { 'mt-3': hasInvalidFields || hasRouteErrors })}>
            {t('stdcmErrors.missingInformations')}
          </p>
          <div>
            {errorDetails?.missingFields!.map((field) => (
              <div key={field}>&bull;&nbsp;{t(`stdcmErrors.missingFields.${field}`)}</div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default StdcmWarningBox;
