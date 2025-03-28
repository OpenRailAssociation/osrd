import { useEffect, useRef } from 'react';

import { Button } from '@osrd-project/ui-core';
import { Alert } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import { StdcmConfigErrorTypes, type StdcmConfigErrors } from '../types';

const SHORT_TEXT_ERRORS = [StdcmConfigErrorTypes.INFRA_NOT_LOADED];

type StdcmWarningBoxProps = {
  errorInfos: {
    errorType: StdcmConfigErrorTypes;
    errorDetails?: StdcmConfigErrors['errorDetails'];
  };
  removeOriginArrivalTime: () => void;
  removeDestinationArrivalTime: () => void;
};

const StdcmWarningBox = ({
  errorInfos: { errorType, errorDetails },
  removeOriginArrivalTime,
  removeDestinationArrivalTime,
}: StdcmWarningBoxProps) => {
  const { t } = useTranslation('stdcm');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (errorType && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [errorType]);

  const hasInvalidFields = (errorDetails?.invalidFields?.length ?? 0) > 0;
  const hasMissingFields = (errorDetails?.missingFields?.length ?? 0) > 0;
  const hasRouteErrors = (errorDetails?.routeErrors?.length ?? 0) > 0;

  return (
    <div ref={ref} data-testid="warning-box" className="warning-box">
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
        <p
          className={cx('mb-0', {
            'text-center': SHORT_TEXT_ERRORS.includes(errorType),
            'text-justify': !SHORT_TEXT_ERRORS.includes(errorType),
          })}
        >
          {t(`stdcmErrors.${errorType}`)}
        </p>
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
