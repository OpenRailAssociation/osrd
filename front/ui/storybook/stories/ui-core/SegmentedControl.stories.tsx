import React, { useState } from 'react';

import { SegmentedControl, type SegmentedControlProps } from '@osrd-project/ui-core';
import { Broadcast, DesktopDownload } from '@osrd-project/ui-icons';
import type { Meta, StoryObj } from '@storybook/react-vite';

import '@osrd-project/ui-core/dist/theme.css';

type Option = { value: string; label: string; icon?: React.ReactNode };
const SegmentedControlWrapper = (props: SegmentedControlProps<Option>) => {
  const [value, setValue] = useState<Option>(props.options[0]);
  return <SegmentedControl {...props} value={value} onChange={(v) => setValue(v)} />;
};

const options = [
  { value: 'blue', label: 'Blue' },
  { value: 'red', label: 'Red' },
  { value: 'green', label: 'Green' },
] as Option[];

const optionsWithIcon = [
  { value: 'broadcast', label: 'Broadcast', icon: <Broadcast /> },
  { value: 'desktopDownload', label: 'DesktopDownload', icon: <DesktopDownload /> },
] as Option[];

const meta: Meta<typeof SegmentedControlWrapper> = {
  component: SegmentedControlWrapper,
  title: 'Core/SegmentedControl',
  tags: ['autodocs'],
  args: {
    name: 'my-choice',
    options,
    getOptionLabel: (option: Option) => option.label,
    getOptionValue: (option: Option) => option.value,
    getOptionIcon: undefined,
  },
};

export default meta;
type Story = StoryObj<typeof SegmentedControlWrapper>;

export const Default: Story = {
  args: {},
};
export const WithIcons: Story = {
  args: {
    options: optionsWithIcon,
    getOptionLabel: (option) => option.label,
    getOptionValue: (option) => option.value,
    getOptionIcon: (option) => option.icon,
  },
};
