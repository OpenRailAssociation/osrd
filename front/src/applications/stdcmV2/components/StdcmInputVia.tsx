import { useState, useMemo, useEffect } from 'react';

import { Input } from '@osrd-project/ui-core';
import { debounce } from 'lodash';
import { useTranslation } from 'react-i18next';

import type { PathStep } from 'reducers/osrdconf/types';
import { ISO8601Duration2sec } from 'utils/timeManipulation';

import { StdcmStopTypes } from '../types';

const StdcmInputVia = ({
  stopType,
  pathStep,
  updatePathStepStopTime,
}: {
  stopType?: StdcmStopTypes;
  pathStep: PathStep;
  updatePathStepStopTime: (stopTime: string) => void;
}) => {
  const { t } = useTranslation('stdcm');

  const [pathStepStopTime, setPathStepStopTime] = useState(
    pathStep.stopFor ? `${ISO8601Duration2sec(pathStep.stopFor) / 60}` : ''
  );

  const stopWarning = stopType === StdcmStopTypes.DRIVER_SWITCH && Number(pathStepStopTime) < 3;

  const debounceUpdatePathStepStopTime = useMemo(
    () => debounce((value) => updatePathStepStopTime(value), 500),
    []
  );

  useEffect(() => {
    let newStopTime = pathStepStopTime;
    const isPassageTime = stopType === StdcmStopTypes.PASSAGE_TIME || stopType === undefined;
    if (isPassageTime && pathStepStopTime !== '0') {
      newStopTime = '0';
    }
    if (newStopTime !== pathStepStopTime) {
      setPathStepStopTime(newStopTime);
      updatePathStepStopTime(newStopTime);
    }
  }, [pathStep.stopFor, stopType]);

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
