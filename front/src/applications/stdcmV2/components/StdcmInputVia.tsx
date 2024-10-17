import { useState, useMemo, useEffect } from 'react';

import { Input } from '@osrd-project/ui-core';
import { debounce } from 'lodash';
import { useTranslation } from 'react-i18next';

import type { PathStep } from 'reducers/osrdconf/types';
import { ISO8601Duration2sec } from 'utils/timeManipulation';

import { StdcmStopTypes } from '../types';

type StdcmInputViaProps = {
  stopType?: StdcmStopTypes;
  pathStepStopFor: PathStep['stopFor'];
  updatePathStepStopTime: (stopTime: string) => void;
};

const StdcmInputVia = ({
  stopType,
  pathStepStopFor,
  updatePathStepStopTime,
}: StdcmInputViaProps) => {
  const { t } = useTranslation('stdcm');

  const computedStopTime = useMemo(
    () => (pathStepStopFor ? `${ISO8601Duration2sec(pathStepStopFor) / 60}` : ''),
    [pathStepStopFor]
  );

  const [pathStepStopTime, setPathStepStopTime] = useState(computedStopTime);

  const stopWarning = stopType === StdcmStopTypes.DRIVER_SWITCH && Number(computedStopTime) < 3;

  const debounceUpdatePathStepStopTime = useMemo(
    () => debounce((value) => updatePathStepStopTime(value), 300),
    []
  );

  useEffect(() => {
    let newStopTime = computedStopTime;
    const isPassageTime = stopType === StdcmStopTypes.PASSAGE_TIME || !stopType;
    if (isPassageTime && newStopTime !== '0') {
      newStopTime = '0';
    }
    if (newStopTime !== pathStepStopTime) {
      setPathStepStopTime(newStopTime);
      updatePathStepStopTime(newStopTime);
    }
  }, [pathStepStopFor, stopType]);

  return (
    stopType !== StdcmStopTypes.PASSAGE_TIME &&
    stopType !== undefined && (
      <div className="stdcm-v2-via-stop-for stop-time">
        <Input
          id="stdcm-v2-via-stop-time"
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
