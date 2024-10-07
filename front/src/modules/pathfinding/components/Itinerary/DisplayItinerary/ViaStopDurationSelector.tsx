import { useEffect, useState } from 'react';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import type { PathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { useDebounce } from 'utils/helpers';
import { ISO8601Duration2sec, formatDurationAsISO8601 } from 'utils/timeManipulation';

const ViaStopDurationSelector = ({
  via,
  focusedViaId,
  setFocusedViaId,
}: {
  via: PathStep;
  focusedViaId?: string;
  setFocusedViaId: (focusedViaIndex?: string) => void;
}) => {
  const dispatch = useAppDispatch();
  const { updateViaStopTime } = useOsrdConfActions();

  const currentStopTime = via.stopFor ? ISO8601Duration2sec(via.stopFor) : 0;

  const [stopTime, setStopTime] = useState(currentStopTime);
  const debouncedStopTime = useDebounce(stopTime, 2000);

  const updateViaStopDuration = (durationInSec: number) => {
    dispatch(updateViaStopTime({ via, duration: formatDurationAsISO8601(durationInSec) }));
  };

  useEffect(() => {
    if (debouncedStopTime !== currentStopTime) {
      updateViaStopDuration(debouncedStopTime);
      setFocusedViaId(undefined);
    }
  }, [debouncedStopTime]);

  return (
    <>
      {via.id !== focusedViaId && (
        <div className="default-durations-button mr-1">
          <button type="button" className="mr-1 px-1" onClick={() => updateViaStopDuration(30)}>
            30s
          </button>
          <button type="button" className="mr-1 px-1" onClick={() => updateViaStopDuration(60)}>
            1min
          </button>
          <button type="button" className="mr-1 px-1" onClick={() => updateViaStopDuration(120)}>
            2min
          </button>
        </div>
      )}
      <div role="button" tabIndex={-1} onClick={() => setFocusedViaId(via.id)}>
        {via.id === focusedViaId ? (
          <InputSNCF
            type="number"
            id={`osrd-config-stoptime-via-${via.id}`}
            onChange={(e) => setStopTime(Number(e.target.value))}
            value={stopTime}
            unit="s"
            focus
            selectAllOnFocus
            sm
            noMargin
            textRight
          />
        ) : (
          <div className="stoptime">{`${currentStopTime}s`}</div>
        )}
      </div>
    </>
  );
};

export default ViaStopDurationSelector;
