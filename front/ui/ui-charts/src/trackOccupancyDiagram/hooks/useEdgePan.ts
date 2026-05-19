import { useCallback, useRef, useEffect } from 'react';

import { DEFAULT_THEME, type SpaceTimeChartProps } from '../../spaceTimeChart';

/** How close to the edge we should start panning */
const PAN_EDGE_DISTANCE = 50;
/** How much time to wait between each pan */
const PAN_INTERVAL_MS = 50;
/** How many pixels to pan each interval */
const PAN_STEP = 5;

type State = {
  intervalID: number | null;
  dy: number;
};

/**
 * Pan when the mouse approaches the edge of the chart. Useful for navigating
 * the chart during drag-and-drop operations.
 */
const useEdgePan = ({
  enableY,
  spaceTimeChartProps,
  pan,
}: {
  enableY?: boolean;
  spaceTimeChartProps: SpaceTimeChartProps;
  pan: (pos: { dy: number }) => void;
}) => {
  const timeCaptionsSize = spaceTimeChartProps.hideTimeCaptions
    ? 0
    : (spaceTimeChartProps.theme?.timeCaptionsSize ?? DEFAULT_THEME.timeCaptionsSize);

  const stateRef = useRef<State>({
    intervalID: null,
    dy: 0,
  });

  const start = useCallback(() => {
    if (!stateRef.current.intervalID) {
      stateRef.current.intervalID = setInterval(() => {
        pan({ dy: stateRef.current.dy });
      }, PAN_INTERVAL_MS);
    }
  }, [pan]);

  const stop = useCallback(() => {
    if (stateRef.current.intervalID) {
      clearInterval(stateRef.current.intervalID);
    }
    stateRef.current.intervalID = null;
  }, []);

  const onMouseMove: SpaceTimeChartProps['onMouseMove'] = useCallback(
    ({ position: { y }, context: { height } }) => {
      if (!enableY) return;

      let delta = 0;
      if (y < PAN_EDGE_DISTANCE) {
        delta = -PAN_STEP;
      }
      if (y > height - PAN_EDGE_DISTANCE - timeCaptionsSize) {
        delta = PAN_STEP;
      }

      stateRef.current.dy = delta;
      if (delta !== 0) {
        start();
      } else {
        stop();
      }
    },
    [enableY, timeCaptionsSize, start, stop]
  );

  // Interrupt current setInterval() when enableY changes or when the
  // component is unmounted
  useEffect(() => stop, [enableY, stop]);

  return { onMouseMove };
};

export default useEdgePan;
