import React, { useState } from 'react';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { RxLapTimer } from 'react-icons/rx';
import type { Dispatch } from 'redux';
import { noop } from 'lodash';

import { sec2time, time2sec } from 'utils/timeManipulation';

import { RUNTIME_CAP } from 'applications/operationalStudies/consts';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';

import type { StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import type { StdcmConfSelectors } from 'reducers/osrdconf/stdcmConf/selectors';

interface RunningTimeProps {
  dispatch?: Dispatch;
}

export function withProps<T>(Component: ComponentType<T>) {
  return function runTimeWithProps(hocProps: T) {
    const dispatch = useDispatch();
    return <Component {...(hocProps as T)} dispatch={dispatch} />;
  };
}

function RunningTime({ dispatch = noop }: RunningTimeProps) {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const { getMaximumRunTime } = useOsrdConfSelectors() as StdcmConfSelectors;
  const { updateMaximumRunTime } = useOsrdConfActions() as StdcmConfSliceActions;
  const maximumRunTime = useSelector(getMaximumRunTime);
  const [isRtBelowCap, setIsRtBelowCap] = useState(true);

  function checkRunTime(time: string): number {
    if (time2sec(time) <= RUNTIME_CAP) {
      setIsRtBelowCap(true);
      return time2sec(time);
    }

    setIsRtBelowCap(false);
    return RUNTIME_CAP;
  }

  return (
    <div className="d-flex mb-2 align-items-center osrd-config-item-container">
      <div className="text-orange mr-2">
        <RxLapTimer />
      </div>
      <div className="font-weight-bold mr-2 flex-grow-1">{t('maximumRunTime')}</div>
      <div className="maximum-run-time-input">
        <InputSNCF
          type="time"
          id="osrd-config-time-maximum-run-time"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            dispatch(updateMaximumRunTime(checkRunTime(e.target.value)))
          }
          value={sec2time(maximumRunTime)}
          sm
          noMargin
          isInvalid={!isRtBelowCap}
          errorMsg={t('maximumRunTimeError')}
        />
      </div>
    </div>
  );
}

export default withProps(RunningTime);
