import React, { useState } from 'react';

import {
  Tooltip,
  SpaceTimeChart,
  PathLayer,
  type Point,
  type PickingElement,
} from '@osrd-project/ui-charts';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { OPERATIONAL_POINTS, PATHS } from './helpers/paths';
import { X_ZOOM_LEVEL, Y_ZOOM_LEVEL } from './helpers/utils';

import '@osrd-project/ui-core/dist/theme.css';
import '@osrd-project/ui-charts/dist/theme.css';

const CustomTooltipContent = ({
  tooltipTitle,
  hoveredElement,
}: {
  tooltipTitle: string;
  hoveredElement: PickingElement;
}) => (
  <div>
    <header>{tooltipTitle}</header>
    <span>{hoveredElement.type}</span>
  </div>
);

/**
 * This story aims at showcasing how to use a custom Tooltip.
 */
const TooltipWrapper = () => {
  const [hoveredElement, setHoveredElement] = useState<PickingElement | null>(null);
  const [cursorPosition, setCursorPosition] = useState<Point | null>(null);

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
          setHoveredElement(item?.element ?? null);
        }}
        onMouseMove={({ position }) => {
          setCursorPosition(position);
        }}
      >
        {PATHS.map((path) => (
          <PathLayer key={path.id} path={path} color={path.color} />
        ))}
        {cursorPosition && hoveredElement && (
          <Tooltip position={cursorPosition}>
            <CustomTooltipContent
              tooltipTitle={'My super element'}
              hoveredElement={hoveredElement}
            />
          </Tooltip>
        )}
      </SpaceTimeChart>
    </div>
  );
};

const meta = {
  title: 'SpaceTimeChart/Tooltip',
  component: TooltipWrapper,
} satisfies Meta<typeof TooltipWrapper>;

export default meta;

export const Default: StoryObj<typeof meta> = {
  name: 'Default arguments',
  args: {},
};
