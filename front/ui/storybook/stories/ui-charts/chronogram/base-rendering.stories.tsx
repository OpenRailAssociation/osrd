import React from 'react';

import { Chronogram, type LevelCrossingData } from '@osrd-project/ui-charts';
import type { Meta } from '@storybook/react-vite';

import { levelCrossingData, START_DATE } from './level-crossing-data';
import '@osrd-project/ui-charts/dist/theme.css';
import '@osrd-project/ui-core/dist/theme.css';

type WrapperProps = {
  levelCrossingsData: LevelCrossingData[];
  height: number;
};

/**
 * This story aims at showcasing how to render an empty Chronogram.
 */
const Wrapper = ({ levelCrossingsData, height }: WrapperProps) => (
  <div className="absolute inset-0">
    <Chronogram timeOrigin={+START_DATE} levelCrossingData={levelCrossingsData} height={height} />
  </div>
);

export default {
  title: 'Chronogram/Rendering',
  component: Wrapper,
  argTypes: {
    height: {
      name: 'Height',
      description: 'Height of the Chronogram (in pixels)',
      defaultValue: 450,
      control: { type: 'range', min: 400, max: 1000, step: 50 },
    },
  },
} as Meta<typeof Wrapper>;

export const WithFakeData = {
  name: 'Default rendering with fake data',
  args: {
    levelCrossingsData: levelCrossingData,
    height: 450,
  },
};
