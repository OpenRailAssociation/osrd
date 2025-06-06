import React from 'react';

import '@osrd-project/ui-charts/dist/theme.css';
import { Manchette } from '@osrd-project/ui-charts';
import '@osrd-project/ui-core/dist/theme.css';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { SAMPLE_WAYPOINTS } from './assets/sampleData';

const meta: Meta<typeof Manchette> = {
  component: Manchette,
  title: 'Manchette/ManchetteSplit',
  tags: ['autodocs'],
  argTypes: { contents: { control: { type: 'object' } } },
};

export default meta;
type Story = StoryObj<typeof Manchette>;

const customDiv = <div style={{ height: '100px', backgroundColor: '#EFF3F5' }} />;

export const Default: Story = {
  args: {
    contents: [
      SAMPLE_WAYPOINTS[0],
      customDiv,
      SAMPLE_WAYPOINTS[1],
      SAMPLE_WAYPOINTS[2],
      customDiv,
      SAMPLE_WAYPOINTS[3],
      customDiv,
    ],
  },
};
