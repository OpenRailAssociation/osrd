import React, { useEffect, useState } from 'react';
import cx from 'classnames';

import { roundNumber, shortNumber } from './utils';

export const ResizingScale = ({
  begin,
  end,
  className,
}: {
  begin: number;
  end: number;
  className?: string;
}) => {
  const [ticksCount, setTicksCount] = useState<number>(10);

  const inf = roundNumber(begin, true);
  const sup = roundNumber(end, false);
  const step = roundNumber((end - begin) / ticksCount / 2, true);

  /** redraw the scale when window resized horizontally */
  useEffect(() => {
    const debounceResize = () => {
      let debounceTimeoutId;
      clearTimeout(debounceTimeoutId);
      debounceTimeoutId = setTimeout(() => {
        const graphWidth = document.getElementById('linear-metadata-dataviz-content')?.offsetWidth;
        if (graphWidth) {
          setTicksCount(Math.round(graphWidth / 100));
        }
      }, 15);
    };
    window.addEventListener('resize', debounceResize);
    return () => {
      window.removeEventListener('resize', debounceResize);
    };
  }, []);

  return (
    <div className={`scale ${className}`}>
      <div className="axis-values">
        {Array(ticksCount)
          .fill(0)
          .map((_, i) => (
            <div key={i}>
              {i === 0 && <span className="bottom-axis-value">{shortNumber(inf)}</span>}
              <span>{shortNumber(((sup - inf) / ticksCount) * i + step + inf)}</span>
              {i === ticksCount - 1 && <span className="top-axis-value">{shortNumber(sup)}</span>}
            </div>
          ))}
      </div>
    </div>
  );
};

export const SimpleScale = ({
  className,
  begin,
  end,
  min,
  max,
}: {
  className?: string;
  begin: number;
  end: number;
  min?: number;
  max?: number;
}) => {
  const [inf, setInf] = useState<number>(0);
  const [sup, setSup] = useState<number>(0);

  useEffect(() => {
    setInf(roundNumber(begin, true));
    setSup(roundNumber(end, false));
  }, [begin, end]);

  return (
    <div className={`scale ${className}`}>
      <div className="axis-values">
        <p
          className={cx(
            (min === undefined || (min !== undefined && min === begin)) && 'font-weight-bold'
          )}
          title={`${inf}`}
        >
          {shortNumber(inf)}
        </p>
        <p
          className={cx(
            (max === undefined || (max !== undefined && max === end)) && 'font-weight-bold'
          )}
          title={`${sup}`}
        >
          {shortNumber(sup)}
        </p>
      </div>
    </div>
  );
};
