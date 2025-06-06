import { Checkbox } from '@osrd-project/ui-core';
import type { Meta, StoryObj } from '@storybook/react-vite';

import '@osrd-project/ui-core/dist/theme.css';

const meta: Meta<typeof Checkbox> = {
  component: Checkbox,
  title: 'Core/Checkbox',
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    isIndeterminate: { control: 'boolean' },
    small: { control: 'boolean' },
    checked: { control: 'boolean' },
    readOnly: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {
  args: {
    label: 'Check this box if you like trains',
  },
};
export const Hint: Story = {
  args: {
    label: 'Butter',
    hint: 'Without salt, sorry',
  },
};
export const Indterminate: Story = {
  args: {
    label: 'Indeterminate',
    isIndeterminate: true,
  },
};
