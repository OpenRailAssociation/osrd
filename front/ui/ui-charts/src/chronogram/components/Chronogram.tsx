import React, { useRef, useState } from 'react';

import { ChronogramCanvas } from './ChronogramCanvas';
import ChronogramManchette from './ChronogramManchette';
import useChronogram from '../hooks/useChronogram';
import { INITIAL_CHRONOGRAM_HEIGHT } from '../lib/const';
import type { ChronogramProps } from '../lib/types';

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
    xOffset,
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
            timeScale={10000}
            xOffset={xOffset}
            yOffset={yOffset}
            levelCrossingsOccupancies={levelCrossingsOccupancies.map((lc) => lc.occupancies)}
          />
        </div>
      </div>
    </div>
  );
};
