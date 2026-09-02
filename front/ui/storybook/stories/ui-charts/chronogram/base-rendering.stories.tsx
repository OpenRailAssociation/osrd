import React from 'react';

import { Chronogram, type LevelCrossingData } from '@osrd-project/ui-charts';
import type { Meta, StoryObj } from '@storybook/react-vite';

import '@osrd-project/ui-charts/dist/theme.css';
import '@osrd-project/ui-core/dist/theme.css';

import { levelCrossingData, START_DATE } from './level-crossing-data';

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

const meta: Meta<typeof Wrapper> = {
  title: 'Chronogram/Rendering',
  component: Wrapper,
  argTypes: {
    height: {
      name: 'Height',
      description: 'Height of the Chronogram (in pixels)',
      value: 450,
      control: { type: 'range', min: 400, max: 1000, step: 50 },
    },
  },
};

export default meta;

export const WithFakeData: StoryObj<typeof Wrapper> = {
  name: 'Default rendering with fake data',
  args: {
    levelCrossingsData: levelCrossingData,
    height: 450,
  },
};
