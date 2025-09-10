import React, { useState } from 'react';

import {
  SpaceTimeChart,
  PathLayer,
  Quadrilateral,
  type QuadrilateralProps,
  isQuadrilaterPickingElement,
  type Point,
  Tooltip,
} from '@osrd-project/ui-charts';
import type { Meta } from '@storybook/react-vite';

import { HOUR, KILOMETER } from './helpers/consts';
import { OPERATIONAL_POINTS, PATHS, START_DATE } from './helpers/paths';
import { X_ZOOM_LEVEL, Y_ZOOM_LEVEL } from './helpers/utils';

import '@osrd-project/ui-core/dist/theme.css';
import '@osrd-project/ui-charts/dist/theme.css';

type WrapperProps = {
  xZoomLevel: number;
  yZoomLevel: number;
  xOffset: number;
  yOffset: number;
  spaceScaleType: 'linear' | 'proportional';
  emptyData: boolean;
};

const QuadrilateralMocks: QuadrilateralProps[] = [
  {
    id: 'P1',
    vertices: [
      { time: START_DATE.getTime() + HOUR, position: 3 * KILOMETER },
      { time: START_DATE.getTime() + HOUR * 3, position: 3 * KILOMETER },
      { time: START_DATE.getTime() + HOUR * 2, position: 11 * KILOMETER },
      { time: START_DATE.getTime(), position: 11 * KILOMETER },
    ],
    style: {
      backgroundColor: 'lightblue',
      borderColor: 'red',
      borderWidth: 1,
    },
  },
  {
    id: 'P2',
    vertices: [
      { time: START_DATE.getTime() + HOUR * 2, position: 30 * KILOMETER },
      { time: START_DATE.getTime() + HOUR * 1, position: 30 * KILOMETER },
      { time: START_DATE.getTime() + HOUR * 3, position: 70 * KILOMETER },
      { time: START_DATE.getTime() + HOUR * 4, position: 70 * KILOMETER },
    ],
    style: {
      backgroundColor: 'lightblue',
      borderColor: 'blue',
      borderWidth: 1,
    },
  },
];

const QuadrilaterTooltip = ({ position, id }: { position: Point; id: string }) => (
  <Tooltip position={position}>
    <div>{id}</div>
  </Tooltip>
);

/**
 * This story aims at showcasing how to render a SpaceTimeChart.
 */
const Wrapper = ({
  xZoomLevel,
  yZoomLevel,
  xOffset,
  yOffset,
  spaceScaleType,
  emptyData,
}: WrapperProps) => {
  const [hoveredQuadrilater, setHoveredQuadrilater] = useState<string>();
  const [cursorPosition, setCursorPosition] = useState<Point>();

  const operationalPoints = emptyData ? [] : OPERATIONAL_POINTS;
  const spaceScales = emptyData
    ? []
    : OPERATIONAL_POINTS.slice(0, -1).map((point, i) => ({
        from: point.position,
        to: OPERATIONAL_POINTS[i + 1].position,
        ...(spaceScaleType === 'linear'
          ? { size: 50 * yZoomLevel }
          : { coefficient: 150 / yZoomLevel }),
      }));
  const paths = emptyData
    ? [
        {
          id: `empty-train`,
          label: `Train with no path`,
          color: 'transparent',
          points: [],
        },
      ]
    : PATHS;

  return (
    <div className="absolute inset-0">
      <SpaceTimeChart
        className="h-full"
        operationalPoints={operationalPoints}
        spaceOrigin={0}
        spaceScales={spaceScales}
        timeOrigin={+START_DATE}
        timeScale={60000 / xZoomLevel}
        xOffset={xOffset}
        yOffset={yOffset}
        onHoveredChildUpdate={({ item }) => {
          if (item && isQuadrilaterPickingElement(item.element)) {
            setHoveredQuadrilater(item.element.id);
          } else {
            setHoveredQuadrilater(undefined);
          }
        }}
        onMouseMove={({ position }) => {
          setCursorPosition(position);
        }}
      >
        {paths.map((path) => (
          <PathLayer
            key={path.id}
            path={path}
            color={path.color}
            border={path.border}
            level={path.level || 2}
          />
        ))}
        {QuadrilateralMocks.map((quadrilateral) => (
          <Quadrilateral
            key={quadrilateral.id}
            id={quadrilateral.id}
            vertices={quadrilateral.vertices}
            style={quadrilateral.style}
          />
        ))}
        {hoveredQuadrilater && cursorPosition && (
          <QuadrilaterTooltip position={cursorPosition} id={hoveredQuadrilater} />
        )}
      </SpaceTimeChart>
    </div>
  );
};

export default {
  title: 'SpaceTimeChart/Quadrilateral',
  component: Wrapper,
  argTypes: {
    xZoomLevel: {
      name: 'X zoom level',
      description: '(in pixels/minute)',
      defaultValue: 0.4,
      control: { type: 'range', min: 0.1, max: 75, step: 0.1 },
    },
    xOffset: {
      name: 'X offset',
      description: '(in pixels)',
      defaultValue: 0,
      control: { type: 'number', step: 10 },
    },
    yZoomLevel: {
      name: 'Y zoom level',
      options: ['linear', 'proportional'],
      defaultValue: 1,
      control: { type: 'range', min: 0.1, max: 10, step: 0.1 },
    },
    yOffset: {
      name: 'Y offset',
      description: '(in pixels)',
      defaultValue: 0,
      control: { type: 'number', step: 10 },
    },
    spaceScaleType: {
      name: 'Space scaling type',
      options: ['linear', 'proportional'],
      defaultValue: 'linear',
      control: { type: 'radio' },
    },
    emptyData: {
      name: 'Use empty data',
      defaultValue: false,
      control: { type: 'boolean' },
    },
  },
} as Meta<typeof Wrapper>;

export const DefaultArgs = {
  name: 'Default arguments',
  args: {
    xZoomLevel: X_ZOOM_LEVEL,
    yZoomLevel: Y_ZOOM_LEVEL,
    xOffset: 0,
    yOffset: 0,
    spaceScaleType: 'linear',
    emptyData: false,
  },
};
