import React, { useEffect, useState } from 'react';

import { PatternRect } from './PatternRect';

export type WorkSchedule = {
  type: 'TRACK' | 'CATENARY';
  timeStart: Date;
  timeEnd: Date;
  spaceRanges: [number, number][];
};

type WorkScheduleLayerProps = {
  workSchedules: WorkSchedule[];
  imageUrl: string;
};

/**
 * Displays the workschedule projection on the Space time chart.
 * A workschedule has a start time and an end time.
 * It can contain several portions of a track occupied during this period.
 * Each portion is represented by a rectangle region
 */
export const WorkScheduleLayer = ({ workSchedules, imageUrl }: WorkScheduleLayerProps) => {
  const [imageElement, setImageElement] = useState<HTMLImageElement>();
  useEffect(() => {
    if (imageUrl) {
      const newImage = new Image();
      newImage.src = imageUrl;
      newImage.onload = () => {
        setImageElement(newImage);
      };
    }
  }, [imageUrl]);

  if (!imageElement) {
    return null;
  }

  return workSchedules.flatMap((ws) =>
    ws.spaceRanges.map(([spaceStart, spaceEnd]) => (
      <PatternRect
        key={`${ws.type}-${ws.timeStart}-${ws.timeEnd}-${spaceStart}-${spaceEnd}`}
        timeStart={ws.timeStart}
        timeEnd={ws.timeEnd}
        spaceStart={spaceStart}
        spaceEnd={spaceEnd}
        imageElement={imageElement}
      />
    ))
  );
};
