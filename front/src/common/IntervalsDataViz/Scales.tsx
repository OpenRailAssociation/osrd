import { useEffect, useState } from 'react';

import cx from 'classnames';

import { isRoundKm, roundNumber, shortNumber } from './utils';

const MIN_DISTANCE_TO_EXTREMITY = 20; // in px

/**
 * Given a value, return the absolute position (in px) corresponding to it on the graph.
 * If the value is not in the interval [begin, end], return 0.
 */
const getPositionFromValue = (
  value: number,
  begin: number,
  end: number,
  graphWidth: number,
  leftPadding: number
) =>
  value > begin && value < end ? ((value - begin) * graphWidth) / (end - begin) + leftPadding : 0;

/**
 * Complete scale for the intervals editor
 * - smart ticks, rounded by km (1km, 3km, etc)
 * - ticks for the extremities are always displayed (begin/end)
 * - ticks which are too close to the extremities are removed
 * - ticks number is adapted to the screen width (even if the window is resized)
 */
export const ResizingScale = ({
  begin,
  end,
  wrapper,
}: {
  begin: number;
  end: number;
  wrapper: HTMLElement;
}) => {
  const [ticks, setTicks] = useState<{ position: number; value: number; isExtremity: boolean }[]>(
    []
  );

  const computeTicks = (_begin: number, _end: number, _wrapper: HTMLElement) => {
    const graphWidth = wrapper.offsetWidth;
    const leftPadding = wrapper.offsetLeft;

    // compute the number of ticks, knowing that space between 2 ticks should be 200px
    const ticksCount = Math.round(graphWidth / 200);

    // compute the default step between 2 values (we want to display only value in km)
    let step = roundNumber((_end - _begin) / ticksCount / 1000) * 1000;
    if (step === 0) step = 1000;

    // compute the ticks (value and position)
    const newTicks = [{ value: _begin, position: leftPadding, isExtremity: true }];

    // find the first tick value (first integer above begin (in km) or begin if it is x km)
    let index = isRoundKm(begin) ? 1 : 0;
    const firstTick = isRoundKm(begin) ? _begin : roundNumber(begin / 1000, true) * 1000;

    // check the second tick is not too close to the first one
    const secondTickPosition = getPositionFromValue(
      step * index + firstTick,
      _begin,
      _end,
      graphWidth,
      leftPadding
    );
    if (secondTickPosition - leftPadding < MIN_DISTANCE_TO_EXTREMITY) {
      index += 1;
    }

    // compute the interior ticks
    while (index * step + firstTick < _end) {
      newTicks.push({
        value: step * index + firstTick,
        position: getPositionFromValue(
          step * index + firstTick,
          _begin,
          _end,
          graphWidth,
          leftPadding
        ),
        isExtremity: false,
      });
      index += 1;
    }

    // check before last tick is not too close to the last tick
    if (
      newTicks[newTicks.length - 1].position - leftPadding >
      graphWidth - MIN_DISTANCE_TO_EXTREMITY
    ) {
      newTicks.pop();
    }

    newTicks.push({ value: _end, position: graphWidth + leftPadding, isExtremity: true });
    return newTicks;
  };

  useEffect(() => {
    const newTicks = computeTicks(begin, end, wrapper);
    setTicks(newTicks);
  }, [begin, end, wrapper]);

  /**
   * When the window is resized horizontally
   * => we recompute the operationalPoints4viz
   */
  useEffect(() => {
    const debounceResize = () => {
      let debounceTimeoutId;
      clearTimeout(debounceTimeoutId);
      debounceTimeoutId = setTimeout(() => {
        const newTicks = computeTicks(begin, end, wrapper);
        setTicks(newTicks);
      }, 15);
    };
    window.addEventListener('resize', debounceResize);
    return () => {
      window.removeEventListener('resize', debounceResize);
    };
  }, [begin, end, wrapper]);

  return (
    <div className="scale resizing-scale-x">
      {ticks.map(({ position, value, isExtremity }, i) => (
        <div
          key={i}
          style={{ position: 'absolute', left: `${position}px` }}
          className={cx(isExtremity && 'is-extremity', i === 0 && 'is-begin')}
        >
          <span>{shortNumber(value)}</span>
        </div>
      ))}
    </div>
  );
};

/**
 * Simple scale with ticks for the begin and the end.
 * Ticks are bolded if they are the real extremities of the whole graph.
 */
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
        <span
          className={cx(
            (min === undefined || (min !== undefined && min === begin)) && 'font-weight-bold'
          )}
          title={`${inf}`}
        >
          {shortNumber(inf)}
        </span>
        <span
          className={cx(
            (max === undefined || (max !== undefined && max === end)) && 'font-weight-bold'
          )}
          title={`${sup}`}
        >
          {shortNumber(sup)}
        </span>
      </div>
    </div>
  );
};
