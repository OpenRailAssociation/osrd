import { DurationInput } from '@osrd-project/ui-core';
import type { Meta, StoryObj } from '@storybook/react-vite';

import '@osrd-project/ui-core/dist/theme.css';

const meta: Meta<typeof DurationInput> = {
  component: DurationInput,
  args: {
    units: ['h', 'm', 's'],
    value: 0,
    padChar: '0',
    max: undefined,
  },
  argTypes: {
    max: { control: 'number', type: { name: 'number', required: false } },
  },
  title: 'Core/DurationInput',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof DurationInput>;

export const Default: Story = {};

export const Labeled: Story = {
  args: {
    label: 'How long are you willing to stay ?',
  },
};

export const Hinted: Story = {
  args: {
    label: 'Your age',
    hint: 'Only for really young people',
    units: ['m', 's'],
    max: 3_600_000,
  },
};

export const Small: Story = {
  args: {
    label: 'Your age',
    hint: 'Only for really young people',
    units: ['m', 's'],
    max: 3_600_000,
    small: true,
  },
};
