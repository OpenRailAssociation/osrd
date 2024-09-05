import { Button } from '@osrd-project/ui-core';
import { Alert } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import type { StdcmConfigErrorTypes, StdcmConfigErrors } from '../types';

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
        <Alert variant="fill" />
      </span>
      <p className="mb-0 text-justify">{t(`stdcmErrors.${errorType}`)}</p>
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
