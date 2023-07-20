import React, { useEffect, useState } from 'react';
import cx from 'classnames';

import { roundNumber, shortNumber } from './utils';

export const ScaleTicked: React.FC<{
  className?: string;
  begin: number;
  end: number;
  steps: number;
}> = ({ className, begin, end, steps }) => {
  const [inf, setInf] = useState<number>(0);
  const [sup, setSup] = useState<number>(0);
  const [inc, setInc] = useState<number>(0);

  useEffect(() => {
    setInf(roundNumber(begin, true));
    setSup(roundNumber(end, false));
    setInc(roundNumber((end - begin) / steps / 2, true));
  }, [begin, end, steps]);

  return (
    <div className={`scale ${className}`}>
      <div className="axis-values">
        {[...Array(steps)].map((_, i) => (
          <div key={i}>
            {i === 0 && <span className="bottom-axis-value">{shortNumber(inf)}</span>}
            <span>{shortNumber(((sup - inf) / steps) * i + inc + inf)}</span>
            {i === steps - 1 && <span className="top-axis-value">{shortNumber(sup)}</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

export const SimpleScale: React.FC<{
  className?: string;
  begin: number;
  end: number;
  min?: number;
  max?: number;
}> = ({ className, begin, end, min, max }) => {
  const [inf, setInf] = useState<number>(0);
  const [sup, setSup] = useState<number>(0);

  useEffect(() => {
    setInf(roundNumber(begin, true));
    setSup(roundNumber(end, false));
  }, [begin, end]);

  return (
    <div className={`scale ${className}`}>
      <span
        className={cx(
          min !== undefined && min === begin && 'font-weight-bold',
          min === undefined && 'font-weight-bold'
        )}
        title={`${inf}`}
      >
        {shortNumber(inf)}
      </span>
      <span
        className={cx(
          max !== undefined && max === end && 'font-weight-bold',
          max === undefined && 'font-weight-bold'
        )}
        title={`${sup}`}
      >
        {shortNumber(sup)}
      </span>
    </div>
  );
};
