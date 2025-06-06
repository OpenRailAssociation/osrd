import React, { useEffect, useState } from 'react';

import {
  TolerancePicker,
  type TolerancePickerProps,
  type ToleranceValues,
} from '@osrd-project/ui-core';
import { type Meta, type StoryObj } from '@storybook/react-vite';

import '@osrd-project/ui-core/dist/theme.css';

const TolerancePickerStory = (props: TolerancePickerProps) => {
  const [toleranceValues, setToleranceValues] = useState<ToleranceValues | undefined>(
    props.toleranceValues
  );
  const onToleranceChange = ({ minusTolerance, plusTolerance }: ToleranceValues) => {
    setToleranceValues({ minusTolerance, plusTolerance });
  };

  useEffect(() => {
    if (props.toleranceValues) setToleranceValues(props.toleranceValues);
  }, [props.toleranceValues]);

  return (
    <TolerancePicker
      {...props}
      toleranceValues={toleranceValues}
      onToleranceChange={onToleranceChange}
    />
  );
};

const meta: Meta<typeof TolerancePicker> = {
  component: TolerancePicker,
  args: { label: 'TolerancePicker', id: 'time-picker' },
  argTypes: { toleranceValues: { minusTolerance: 'number', plusTolerance: 'number' } },
  title: 'core/TolerancePicker',
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ maxWidth: '11em' }}>
          <Story />
        </div>
      </div>
    ),
  ],
  render: TolerancePickerStory,
};

export default meta;
type Story = StoryObj<typeof TolerancePicker>;

export const Default: Story = { args: { label: 'Tolerance' } };

export const Narrow: Story = { args: { label: 'Tolerance', narrow: true } };

export const DisabledTolerancePicker: Story = { args: { disabled: true, label: 'Tolerance' } };

export const WarningTolerancePicker: Story = {
  args: { toleranceValues: { minusTolerance: 200, plusTolerance: 600 }, label: 'Tolerance' },
};

export const ScrollableHeightTolerancePicker: Story = {
  args: {},
  decorators: [
    (Story) => (
      <div style={{ height: '1200px' }}>
        <Story />
      </div>
    ),
  ],
};
