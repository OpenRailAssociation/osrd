import React from 'react';

import { Button } from '@osrd-project/ui-core';
import { Archive, Bookmark, Cloud, Clock } from '@osrd-project/ui-icons';
import type { Meta, StoryObj } from '@storybook/react-vite';
import '@osrd-project/ui-core/dist/theme.css';

const icons = { archive: <Archive />, bookmark: <Bookmark />, cloud: <Cloud />, clock: <Clock /> };

const meta: Meta<typeof Button> = {
  component: Button,
  title: 'Core/Button',
  tags: ['autodocs'],
  argTypes: {
    leadingIcon: {
      options: Object.keys(icons), // An array of serializable values
      mapping: icons, // Maps serializable option values to complex arg values
      control: {
        type: 'select', // Type 'select' is automatically inferred when 'options' is defined
        labels: {
          // 'labels' maps option values to string labels
          Archive: 'Archive',
          Bookmark: 'Bookmark',
          Cloud: 'Cloud',
          Clock: 'Clock',
        },
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: {
    label: 'Click me',
  },
};

export const Loading: Story = {
  args: {
    label: 'Loading',
    isLoading: true,
  },
};

export const Disabled: Story = {
  args: {
    label: 'Disabled',
    isDisabled: true,
  },
};

export const Counter: Story = {
  args: {
    label: 'Counter',
    counter: 5,
  },
};

export const Quiet: Story = {
  args: {
    label: 'Quiet',
    variant: 'Quiet',
  },
};

export const Destructive: Story = {
  args: {
    label: 'Destructive',
    variant: 'Destructive',
  },
};

export const Cancel: Story = {
  args: {
    label: 'Cancel',
    variant: 'Cancel',
  },
};

export const LeadingIcon: Story = {
  args: {
    label: 'Leading Icon',
    leadingIcon: <Archive />,
  },
};

export const LeadingIconCounter: Story = {
  args: {
    label: 'Leading Icon Counter',
    leadingIcon: <Archive />,
    counter: 5,
  },
};

export const GenericButtonProps: Story = {
  args: {
    label: 'Generic properties',
    type: 'button',
    className: 'my-super-class',
    // eslint-disable-next-line no-console
    onMouseEnter: (e) => console.log('mouve enter', e),
  },
};
