import React, { useState, useEffect } from 'react';

import { TimePicker, type TimePickerProps } from '@osrd-project/ui-core';
import { type Meta, type StoryObj } from '@storybook/react-vite';

import '@osrd-project/ui-core/dist/theme.css';

const TimePickerStory = (props: TimePickerProps) => {
  const [selectedHour, setSelectedHour] = useState(props.hours);
  const [selectedMinute, setSelectedMinute] = useState(props.minutes);
  const [selectedSecond, setSelectedSecond] = useState(props.seconds);
  const onTimeChange = (newTime: { hours: number; minutes: number; seconds?: number }) => {
    setSelectedHour(newTime.hours);
    setSelectedMinute(newTime.minutes);
    setSelectedSecond(newTime.seconds);
  };
  useEffect(() => {
    setSelectedHour(props.hours);
    setSelectedMinute(props.minutes);
    setSelectedSecond(props.seconds);
  }, [props.hours, props.minutes, props.seconds]);
  return (
    <TimePicker
      testIdPrefix="time-picker"
      {...props}
      hours={selectedHour}
      minutes={selectedMinute}
      seconds={selectedSecond}
      onTimeChange={onTimeChange}
    />
  );
};

const meta: Meta<typeof TimePicker> = {
  component: TimePicker,
  args: { disabled: false, readOnly: false, displaySeconds: false },
  argTypes: {
    hours: { control: { type: 'number', min: 0, max: 23, step: 1 } },
    minutes: { control: { type: 'number', min: 0, max: 59, step: 1 } },
  },
  title: 'Core/TimePicker',
  tags: ['autodocs'],
  render: TimePickerStory,
};

export default meta;
type Story = StoryObj<typeof TimePicker>;

export const Default: Story = {
  args: { label: 'Time' },
  decorators: [
    (Story) => (
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ maxWidth: '6.7rem', minHeight: '500px' }}>
          <Story />
        </div>
      </div>
    ),
  ],
};

export const Narrow: Story = {
  args: { label: 'Time', narrow: true },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: '6.7rem', minHeight: '500px' }}>
        <Story />
      </div>
    ),
  ],
};

export const DisabledTimePicker: Story = {
  args: { disabled: true, label: 'Time' },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: '6.7rem', minHeight: '500px' }}>
        <Story />
      </div>
    ),
  ],
};

export const TimePickerWithSeconds: Story = {
  args: { displaySeconds: true, label: 'Time' },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: '8.5rem', minHeight: '500px' }}>
        <Story />
      </div>
    ),
  ],
};
