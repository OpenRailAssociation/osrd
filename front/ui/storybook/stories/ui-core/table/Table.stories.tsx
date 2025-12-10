import React from 'react';

import { Table } from '@osrd-project/ui-core';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { SAMPLE_COLUMNS, SAMPLE_DATA, TABLE_ROW_BACKGROUNDS } from './assets/sampleTableData';

const TableStoryWrapper = ({
  ambientMode,
  columns,
  data,
}: {
  ambientMode: keyof typeof TABLE_ROW_BACKGROUNDS;
  columns: typeof SAMPLE_COLUMNS;
  data: typeof SAMPLE_DATA;
}) => {
  const theme = TABLE_ROW_BACKGROUNDS[ambientMode];

  return (
    <div
      className="ambient-wrapper"
      style={
        {
          '--mix-color-1': theme.mix1,
          '--mix-color-2': theme.mix2,
          '--row-bg-odd': theme.odd,
          '--row-bg-even': theme.even,
        } as React.CSSProperties
      }
    >
      <Table columns={columns} data={data} />
    </div>
  );
};

const meta: Meta<typeof TableStoryWrapper> = {
  title: 'Core/Table',
  component: TableStoryWrapper,
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
    ambientMode: 'ambientB',
    columns: SAMPLE_COLUMNS,
    data: SAMPLE_DATA,
  },
  argTypes: {
    ambientMode: {
      control: 'select',
      options: ['ambientA', 'ambientB', 'ambientC', 'ambientD'],
    },
  },
  render: (args) => <TableStoryWrapper {...args} />,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof TableStoryWrapper>;

export const DefaultTable: Story = {
  args: {
    ambientMode: 'ambientB',
    columns: SAMPLE_COLUMNS,
    data: SAMPLE_DATA,
  },
  argTypes: {
    ambientMode: {
      control: 'select',
      options: ['ambientA', 'ambientB', 'ambientC', 'ambientD'],
    },
  },
};
