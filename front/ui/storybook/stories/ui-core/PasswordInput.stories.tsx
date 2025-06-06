import React from 'react';

import { PasswordInput } from '@osrd-project/ui-core';
import type { Meta, StoryObj } from '@storybook/react-vite';

import '@osrd-project/ui-core/dist/theme.css';

const meta: Meta<typeof PasswordInput> = {
  component: PasswordInput,
  args: {
    label: 'Password',
    hint: 'You can uses spaces',
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: '20rem' }}>
        <Story />
      </div>
    ),
  ],
  title: 'Core/PasswordInput',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof PasswordInput>;

export const Default: Story = {
  args: {},
};
