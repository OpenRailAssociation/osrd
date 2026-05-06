import { Switch } from '@osrd-project/ui-core';
import type { Meta, StoryObj } from '@storybook/react-vite';

import '@osrd-project/ui-core/dist/theme.css';

const meta: Meta<typeof Switch> = {
  component: Switch,
  title: 'Core/Switch',
  tags: ['autodocs'],
  args: {
    size: 'md',
    label: '',
    disabled: false,
  },
};

export default meta;
type Story = StoryObj<typeof Switch>;
export const Default: Story = {};

export const Labeled: Story = {
  args: {
    label: 'Check me out',
  },
};

export const Small: Story = {
  args: {
    size: 'sm',
  },
};

export const LabeledSmall: Story = {
  args: {
    size: 'sm',
    label: 'I may be small but I have a label',
  },
};

export const XSmall: Story = {
  args: {
    size: 'xs',
  },
};

export const LabeledXSmall: Story = {
  args: {
    size: 'xs',
    label: 'Click me if you can read this',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    label: "You can't click me",
  },
};

export const DisabledAndChecked: Story = {
  args: {
    disabled: true,
    checked: true,
    label: 'My time is now now',
  },
};
