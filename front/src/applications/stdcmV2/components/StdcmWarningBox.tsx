import { Button } from '@osrd-project/ui-core';
import { Alert } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import { StdcmConfigErrorTypes, type StdcmConfigErrors } from '../types';

const SHORT_TEXT_ERRORS = [
  StdcmConfigErrorTypes.INFRA_NOT_LOADED,
  StdcmConfigErrorTypes.MISSING_LOCATION,
];

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
  return (
    <div className="warning-box">
      <span>
        <Alert variant="fill" size="lg" />
      </span>
      <p
        className={cx('mb-0', {
          'text-center': SHORT_TEXT_ERRORS.includes(errorType),
          'text-justify': !SHORT_TEXT_ERRORS.includes(errorType),
        })}
      >
        {t(`stdcmErrors.${errorType}`)}
      </p>
      {errorType === 'bothPointAreScheduled' && errorDetails && (
        <div className="stdcm-warning-buttons">
          <Button
            type="button"
            onClick={removeDestinationArrivalTime}
            label={errorDetails.originTime}
          />
          <Button
            type="button"
            onClick={removeOriginArrivalTime}
            label={errorDetails.destinationTime}
          />
        </div>
      )}
    </div>
  );
};

export default StdcmWarningBox;
