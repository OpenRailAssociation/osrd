import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { TokenInput } from '@osrd-project/ui-core';
import '@osrd-project/ui-core/dist/theme.css';

const meta: Meta<typeof TokenInput> = {
  component: TokenInput,
  args: {
    label: 'Favorite colors',
    tokens: ['Yellow', 'Orange', 'Red', 'Black'],
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: '20rem' }}>
        <Story />
      </div>
    ),
  ],
  title: 'Core/TokenInput',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof TokenInput>;

export const Default: Story = {
  args: {},
};
