import React, { useEffect, useRef, useState } from 'react';

import { Slider } from '@osrd-project/ui-core';

import { zoomValueToTimeScale } from '../../manchette/utils/helpers';
import useChronogram from '../hooks/useChronogram';
import { CHRONOGRAM_SLIDER_WIDTH, INITIAL_CHRONOGRAM_HEIGHT } from '../lib/const';
import type { ChronogramProps } from '../lib/types';
import { ChronogramCanvas } from './ChronogramCanvas';
import ChronogramManchette from './ChronogramManchette';

export const Chronogram = ({
  levelCrossingData,
  timeOrigin,
  height = INITIAL_CHRONOGRAM_HEIGHT,
}: ChronogramProps) => {
  const chronogramManchetteRef = useRef<HTMLDivElement>(null);
  const chronogramChartRef = useRef<HTMLDivElement>(null);

  const [levelCrossingsOccupancies, setLevelCrossingsOccupancies] = useState(levelCrossingData);

  const {
    height: chronogramHeight,
    handleVerticalScroll,
    handleXZoom,
    handleXZoomOnWheelEvent,
    onPan,
    xOffset,
    xZoom,
    yOffset,
  } = useChronogram({
    itemCount: levelCrossingsOccupancies.length,
    chronogramManchetteRef,
    chronogramChartRef,
    chronogramHeight: height,
  });

  function handleDeleteLevelCrossing(name: string) {
    setLevelCrossingsOccupancies((previousLevelCrossingsOccupancies) =>
      previousLevelCrossingsOccupancies.filter((lc) => lc.name !== name)
    );
  }

  useEffect(() => {
    // TODO: fix this lint
    /* eslint-disable-next-line react-hooks-js/set-state-in-effect */
    setLevelCrossingsOccupancies(levelCrossingData);
  }, [levelCrossingData]);

  return (
    <div className="ui-chronogram" style={{ height }}>
      <div
        ref={chronogramManchetteRef}
        className="chronogram-manchette-container flex"
        onScroll={handleVerticalScroll}
      >
        <ChronogramManchette
          onDelete={handleDeleteLevelCrossing}
          levelCrossingsNames={levelCrossingsOccupancies.map((lc) => lc.name)}
          height={chronogramHeight}
        />
        <div ref={chronogramChartRef} className="chronogram-container">
          <ChronogramCanvas
            timeOrigin={timeOrigin}
            timeScale={zoomValueToTimeScale(xZoom)}
            xOffset={xOffset}
            yOffset={yOffset}
            levelCrossingsOccupancies={levelCrossingsOccupancies.map((lc) => lc.occupancies)}
            onPan={onPan}
            onZoom={({ delta, position, event }) => {
              handleXZoomOnWheelEvent(event, xZoom + delta, position.x);
            }}
          />
        </div>
      </div>
      <Slider
        containerClassName="chronogram-slider-container"
        className="chronogram-slider"
        width={CHRONOGRAM_SLIDER_WIDTH}
        value={xZoom}
        onChange={(e) => {
          handleXZoom(Number(e.target.value));
        }}
      />
    </div>
  );
};
