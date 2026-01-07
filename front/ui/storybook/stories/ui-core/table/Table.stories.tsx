import React from 'react';

import { Table } from '@osrd-project/ui-core';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { SAMPLE_COLUMNS, SAMPLE_DATA } from './assets/sampleTableData';

const meta: Meta<typeof Table> = {
  title: 'Core/Table',
  component: Table,
  decorators: [(Story) => <Story />],
  parameters: {
    backgrounds: {
      default: 'lightSand',
      values: [
        {
          name: 'lightSand',
          value: 'rgba(247, 246, 238, 1)',
        },
      ],
    },
  },
  args: {
    columns: SAMPLE_COLUMNS,
    data: SAMPLE_DATA,
    ambientVariant: 'B',
  },
  argTypes: {
    ambientVariant: {
      control: 'select',
      options: ['A', 'B', 'C', 'D'],
    },
  },
  render: (args) => <Table {...args} />,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Table>;

export const DefaultTable: Story = {
  args: {
    columns: SAMPLE_COLUMNS,
    data: SAMPLE_DATA,
    ambientVariant: 'B',
  },
  argTypes: {
    ambientVariant: {
      control: 'select',
      options: ['A', 'B', 'C', 'D'],
    },
  },
};
