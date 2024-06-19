import React, { useState } from 'react';

import { Input } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

import type { PathStep } from 'reducers/osrdconf/types';
import { ISO8601Duration2sec } from 'utils/timeManipulation';

const StdcmInputVia = ({
  pathStep,
  updatePathStepStopTime,
}: {
  pathStep: PathStep;
  updatePathStepStopTime: (stopTime: string) => void;
}) => {
  const { t } = useTranslation('stdcm');

  const [pathStepStopTime, setPathStepStopTime] = useState(
    pathStep.stopFor ? `${ISO8601Duration2sec(pathStep.stopFor) / 60}` : ''
  );

  return (
    <div className="stdcm-v2-via-stop-for pl-2">
      <Input
        id="stdcm-v2-via-stop-time"
        type="text"
        label={t('trainPath.stopFor')}
        onChange={(e) => {
          // TODO: Find a better way to prevent user from entering decimal values
          const value = e.target.value.replace(/[\D.,]/g, '');
          setPathStepStopTime(value);
        }}
        onBlur={() => updatePathStepStopTime(pathStepStopTime)}
        value={pathStepStopTime}
        trailingContent="minutes"
      />
    </div>
  );
};

export default StdcmInputVia;
