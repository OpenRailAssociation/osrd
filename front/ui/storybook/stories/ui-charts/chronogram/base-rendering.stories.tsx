import React from 'react';

import { Chronogram } from '@osrd-project/ui-charts';
import type { Meta } from '@storybook/react-vite';

import { X_ZOOM_LEVEL } from '../spaceTimeChart/helpers/utils';

import '@osrd-project/ui-charts/dist/theme.css';
import '@osrd-project/ui-core/dist/theme.css';

type WrapperProps = {
  xZoomLevel: number;
  xOffset: number;
  yOffset: number;
};

/**
 * This story aims at showcasing how to render an empty Chronogram.
 */
const Wrapper = ({ xZoomLevel, xOffset, yOffset }: WrapperProps) => (
  <div className="absolute inset-0">
    <Chronogram
      className="h-full"
      timeOrigin={+new Date('2024/04/02')}
      timeScale={60000 / xZoomLevel}
      xOffset={xOffset}
      yOffset={yOffset}
      levelCrossingsNames={[]}
      levelCrossingsOccupancies={[]}
    ></Chronogram>
  </div>
);

export default {
  title: 'Chronogram/Rendering',
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
    yOffset: {
      name: 'Y offset',
      description: '(in pixels)',
      defaultValue: 0,
      control: { type: 'number', step: 10 },
    },
  },
} as Meta<typeof Wrapper>;

export const DefaultArgs = {
  name: 'Default arguments',
  args: {
    xZoomLevel: X_ZOOM_LEVEL,
    xOffset: 0,
    yOffset: 0,
  },
};
