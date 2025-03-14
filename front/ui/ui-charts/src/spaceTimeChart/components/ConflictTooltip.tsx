import React from 'react';

import { Tooltip } from './Tooltip';
import type { Point } from '../lib/types';

export type ConflictTooltipProps = {
  position: Point;
  time: number;

  spaceStart: number;
  spaceEnd: number;
  timeStart: number;
  timeEnd: number;
  type: string;
  trains: string[];
};

const formatDistance = (meters: number) => {
  const km = meters / 1000;
  return km.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
};

export const ConflictTooltip = ({
  position,
  time,
  spaceStart,
  spaceEnd,
  timeStart,
  timeEnd,
  type,
  trains,
}: ConflictTooltipProps) => (
  <Tooltip position={position}>
    <div className="time">{new Date(time).toLocaleTimeString()}</div>
    <div className="position-range">
      <div className="start-position">{formatDistance(spaceStart)}</div>
      <div className="end-position">{formatDistance(spaceEnd)}</div>
    </div>
    <div className="type-and-duration">
      <div>{type}</div>
      <div>{Math.round((timeEnd - timeStart) / 1000)}s</div>
    </div>
    <div className="trains">{trains.join(', ')}</div>
  </Tooltip>
);
