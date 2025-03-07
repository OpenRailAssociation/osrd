import { useMemo, useEffect, useState } from 'react';

import { Input } from '@osrd-project/ui-core';
import type { Status } from '@osrd-project/ui-core/dist/components/inputs/StatusMessage';
import { useTranslation } from 'react-i18next';

import { updateStdcmPathStep } from 'reducers/osrdconf/stdcmConf';
import type { StdcmPathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { useDebounce } from 'utils/helpers';
import { parseNumber } from 'utils/strings';

import { StdcmStopTypes } from '../../types';

type StopDurationInputProps = {
  pathStep: Extract<StdcmPathStep, { isVia: true }>;
};

const StopDurationInput = ({ pathStep }: StopDurationInputProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('stdcm');

  const [stopDuration, setStopDuration] = useState(
    pathStep.stopFor !== undefined ? `${pathStep.stopFor}` : ''
  );
  const debouncedStopDuration = useDebounce(stopDuration, 300);

  const stopWarning = useMemo(
    () =>
      pathStep.stopType === StdcmStopTypes.DRIVER_SWITCH &&
      pathStep.stopFor !== undefined &&
      pathStep.stopFor < 3
        ? {
            status: 'warning' as Status,
            message: t('trainPath.warningMinStopTime'),
          }
        : undefined,
    [pathStep.stopType, pathStep.stopFor]
  );

  useEffect(() => {
    setStopDuration(pathStep.stopFor !== undefined ? `${pathStep.stopFor}` : '');
  }, [pathStep.stopFor]);

  useEffect(() => {
    const parsedNumber = parseNumber(debouncedStopDuration);
    const newStopDuration = parsedNumber !== undefined ? Math.round(parsedNumber) : undefined;
    if (newStopDuration !== pathStep.stopFor) {
      dispatch(
        updateStdcmPathStep({
          id: pathStep.id,
          updates: { stopFor: newStopDuration },
        })
      );
    }
  }, [debouncedStopDuration]);

  return (
    <div className="stop-time">
      <Input
        id="stdcm-via-stop-time"
        data-testid="stdcm-via-stop-time"
        type="text"
        label={t('trainPath.stopFor')}
        onChange={(e) => {
          setStopDuration(e.target.value);
        }}
        value={stopDuration}
        trailingContent="minutes"
        statusWithMessage={stopWarning}
      />
    </div>
  );
};

export default StopDurationInput;
