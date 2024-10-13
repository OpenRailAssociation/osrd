import { useMemo, useEffect, useState } from 'react';

import { Input } from '@osrd-project/ui-core';
import { debounce } from 'lodash';
import { useTranslation } from 'react-i18next';

import type { PathStep } from 'reducers/osrdconf/types';
import { ISO8601Duration2sec, secToMin } from 'utils/timeManipulation';

import { StdcmStopTypes } from '../../types';

type StdcmInputViaProps = {
  stopType: StdcmStopTypes;
  stopDuration: PathStep['stopFor'];
  updatePathStepStopTime: (stopTime: string) => void;
};

const StdcmInputVia = ({ stopType, stopDuration, updatePathStepStopTime }: StdcmInputViaProps) => {
  const { t } = useTranslation('stdcm');

  const computedStopTime = useMemo(() => {
    const duration = stopDuration ? `${secToMin(ISO8601Duration2sec(stopDuration))}` : '';
    switch (stopType) {
      case StdcmStopTypes.PASSAGE_TIME:
        return '0';
      case StdcmStopTypes.DRIVER_SWITCH:
        return duration || '3';
      default:
        return duration || '0';
    }
  }, [stopDuration, stopType]);

  const [pathStepStopTime, setPathStepStopTime] = useState(computedStopTime);

  const stopWarning = stopType === StdcmStopTypes.DRIVER_SWITCH && Number(computedStopTime) < 3;

  const debounceUpdatePathStepStopTime = useMemo(
    () => debounce((value) => updatePathStepStopTime(value), 300),
    []
  );

  useEffect(() => {
    setPathStepStopTime(computedStopTime);
  }, [computedStopTime]);

  return (
    stopType !== StdcmStopTypes.PASSAGE_TIME && (
      <div className="stdcm-v2-via-stop-for stop-time">
        <Input
          id="stdcm-via-stop-time"
          type="text"
          label={t('trainPath.stopFor')}
          onChange={(e) => {
            // TODO: Find a better way to prevent user from entering decimal values
            const value = e.target.value.replace(/[\D.,]/g, '');
            setPathStepStopTime(value);
            debounceUpdatePathStepStopTime(value);
          }}
          value={pathStepStopTime}
          trailingContent="minutes"
          statusWithMessage={
            stopWarning
              ? {
                  status: 'warning',
                  message: t('trainPath.warningMinStopTime'),
                }
              : undefined
          }
        />
      </div>
    )
  );
};

export default StdcmInputVia;
