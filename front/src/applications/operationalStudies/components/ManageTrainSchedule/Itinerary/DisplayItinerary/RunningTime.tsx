import React, { ComponentType, useState } from 'react';
import { useDispatch } from 'react-redux';
import { updateMaximumRunTime } from 'reducers/osrdconf';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { Dispatch } from 'redux';
import { noop } from 'lodash';
import { RxLapTimer } from 'react-icons/rx';
import 'styles/main.css';

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
  const [maximumRuntime, setMaximumRunTime] = useState<string | undefined>(undefined);
  const [isRtBelowCap, setIsRtBelowCap] = useState(true);
  const runTimeCap = 43200;

  function getSeconds(time: string): number | undefined {
    if (time === '00:00:00') {
      setMaximumRunTime(time);
      return undefined;
    }
    if (time < '12:00:01') {
      setMaximumRunTime(time);
      setIsRtBelowCap(true);
    } else {
      setMaximumRunTime('12:00:00');
      setIsRtBelowCap(false);
    }
    const [hours, minutes, seconds] = time.split(':');
    const totalSeconds =
      parseInt(hours, 10) * 3600 + parseInt(minutes, 10) * 60 + parseInt(seconds, 10);
    return totalSeconds <= runTimeCap ? totalSeconds : runTimeCap;
  }

  return (
    <>
      <div className="d-flex running-time">
        <span className="d-flex timer-svg align-items-center">
          <RxLapTimer />
        </span>
        <div className="my-2 ml-3 d-flex flex-column align-items-start w-100">
          <strong className="mb-2">Temps de parcours maximum :</strong>
          <InputSNCF
            type="time"
            id="osrd-config-time-maximum-run-time"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              dispatch(updateMaximumRunTime(getSeconds(e.target.value)))
            }
            value={maximumRuntime}
            sm
            noMargin
          />
        </div>
      </div>
      {!isRtBelowCap && (
        <p className="max-run-time-error">Le temps de parcours ne doit pas excéder 12h</p>
      )}
    </>
  );
}

export default withProps(RunningTime);
