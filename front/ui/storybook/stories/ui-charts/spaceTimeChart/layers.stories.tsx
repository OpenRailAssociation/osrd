import React, { useState } from 'react';

import {
  type Conflict,
  ConflictLayer,
  ConflictTooltip,
  OccupancyBlockLayer,
  SpaceTimeChart,
  PathLayer,
  isConflictPickingElement,
  type Point,
} from '@osrd-project/ui-charts';
import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  KILOMETER,
  MINUTE,
  OCCUPANCY_FREE,
  OCCUPANCY_SEMAPHORE,
  OCCUPANCY_WARNING,
} from './helpers/consts';
import { OPERATIONAL_POINTS, PATHS, START_DATE } from './helpers/paths';
import { X_ZOOM_LEVEL, Y_ZOOM_LEVEL } from './helpers/utils';

import '@osrd-project/ui-core/dist/theme.css';
import '@osrd-project/ui-charts/dist/theme.css';

const CONFLICTS = [
  {
    timeStart: +START_DATE + 15 * MINUTE,
    timeEnd: +START_DATE + 20 * MINUTE,
    spaceStart: 12 * KILOMETER,
    spaceEnd: 19 * KILOMETER,
  },
  {
    timeStart: +START_DATE + 20 * MINUTE,
    timeEnd: +START_DATE + 35 * MINUTE,
    spaceStart: 19 * KILOMETER,
    spaceEnd: 39 * KILOMETER,
  },
  {
    timeStart: +START_DATE + 35 * MINUTE,
    timeEnd: +START_DATE + 37 * MINUTE,
    spaceStart: 39 * KILOMETER,
    spaceEnd: 41 * KILOMETER,
  },
];

const CONFLICT_GROUP = {
  spaceStart: 12 * KILOMETER,
  spaceEnd: 41 * KILOMETER,
  timeStart: +START_DATE + 15 * MINUTE,
  timeEnd: +START_DATE + 37 * MINUTE,
  type: 'Spacing',
  trains: ['4655', '6079'],
};

const OCCUPANCY_BLOCKS = [
  {
    timeStart: +START_DATE + 42 * MINUTE,
    timeEnd: +START_DATE + 43 * MINUTE,
    spaceStart: 10 * KILOMETER,
    spaceEnd: 14 * KILOMETER,
    color: OCCUPANCY_FREE,
  },
  {
    timeStart: +START_DATE + 43 * MINUTE,
    timeEnd: +START_DATE + 46 * MINUTE,
    spaceStart: 10 * KILOMETER,
    spaceEnd: 14 * KILOMETER,
    color: OCCUPANCY_SEMAPHORE,
  },
  {
    timeStart: +START_DATE + 46 * MINUTE,
    timeEnd: +START_DATE + 48 * MINUTE,
    spaceStart: 10 * KILOMETER,
    spaceEnd: 14 * KILOMETER,
    color: OCCUPANCY_WARNING,
    blinking: true,
  },
  {
    timeStart: +START_DATE + 44 * MINUTE,
    timeEnd: +START_DATE + 45 * MINUTE,
    spaceStart: 14 * KILOMETER,
    spaceEnd: 18 * KILOMETER,
    color: OCCUPANCY_FREE,
  },
  {
    timeStart: +START_DATE + 45 * MINUTE,
    timeEnd: +START_DATE + 48 * MINUTE,
    spaceStart: 14 * KILOMETER,
    spaceEnd: 18 * KILOMETER,
    color: OCCUPANCY_SEMAPHORE,
  },
  {
    timeStart: +START_DATE + 48 * MINUTE,
    timeEnd: +START_DATE + 50 * MINUTE,
    spaceStart: 14 * KILOMETER,
    spaceEnd: 18 * KILOMETER,
    color: OCCUPANCY_WARNING,
  },
];

/**
 * This story aims at showcasing various additional layers.
 */
const Wrapper = () => {
  const [hoveredConflict, setHoveredConflict] = useState<Conflict | null>(null);
  const [cursorPosition, setCursorPosition] = useState<Point | null>(null);
  const [cursorTime, setCursorTime] = useState<number>(0);

  return (
    <div className="absolute inset-0">
      <SpaceTimeChart
        className="h-full overflow-hidden p-0 m-0"
        operationalPoints={OPERATIONAL_POINTS}
        spaceOrigin={0}
        spaceScales={OPERATIONAL_POINTS.slice(0, -1).map((point, i) => ({
          from: point.position,
          to: OPERATIONAL_POINTS[i + 1].position,
          size: 50 * Y_ZOOM_LEVEL,
        }))}
        timeOrigin={+new Date('2024/04/02')}
        timeScale={60000 / X_ZOOM_LEVEL}
        xOffset={0}
        yOffset={0}
        onHoveredChildUpdate={({ item }) => {
          let conflict = null;
          if (item && isConflictPickingElement(item.element)) {
            conflict = CONFLICTS[item.element.conflictIndex];
          }
          setHoveredConflict(conflict);
        }}
        onMouseMove={({ position, data }) => {
          setCursorPosition(position);
          setCursorTime(data.time);
        }}
      >
        {PATHS.map((path) => (
          <PathLayer key={path.id} path={path} color={path.color} />
        ))}
        <ConflictLayer conflicts={CONFLICTS} />
        <OccupancyBlockLayer occupancyBlocks={OCCUPANCY_BLOCKS} />
        {hoveredConflict && cursorPosition && (
          <ConflictTooltip {...CONFLICT_GROUP} position={cursorPosition} time={cursorTime} />
        )}
      </SpaceTimeChart>
    </div>
  );
};

const meta = {
  title: 'SpaceTimeChart/Layers',
  component: Wrapper,
} satisfies Meta<typeof Wrapper>;

export default meta;

export const Default: StoryObj<typeof meta> = {
  name: 'Default arguments',
  args: {},
};
