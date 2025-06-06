import React from 'react';

import { RadioGroup, type RadioButtonProps } from '@osrd-project/ui-core';
import { type StoryObj, type Meta } from '@storybook/react-vite';

import '@osrd-project/ui-core/dist/theme.css';

const buildFruitsOptions: (prefixId: string) => RadioButtonProps[] = (prefixId) => [
  {
    id: `${prefixId}-banana-${Date.now()}`,
    label: 'Banana',
    value: 'Banana',
  },
  {
    id: `${prefixId}-pear-${Date.now()}`,
    label: 'Pear',
    value: 'Pear',
  },
  {
    id: `${prefixId}-litchee-${Date.now()}`,
    label: 'Litchee',
    value: 'Litchee',
  },
];

const meta: Meta<typeof RadioGroup> = {
  component: RadioGroup,
  render: (props) => <RadioGroup {...props} options={buildFruitsOptions('doc')} />,
  args: {
    small: false,
    disabled: false,
    readOnly: false,
  },
  tags: ['autodocs'],
  title: 'Core/RadioGroup',
};

export default meta;

type Story = StoryObj<typeof RadioGroup>;

export const Default: Story = {
  args: {
    options: buildFruitsOptions('default'),
  },
};

export const GroupWithLabel: Story = {
  args: {
    label: 'Choose a flavour',
    options: buildFruitsOptions('groupWithLabel'),
  },
  render: (currentArgs) => <RadioGroup {...currentArgs} />,
};

export const GroupLabelCaption: Story = {
  args: {
    label: 'Pick a flower',
    subtitle: 'And put a smile on your face',
    options: [
      {
        label: 'Iris',
        value: 'Iris',
      },
      {
        label: 'Daisy',
        value: 'Daisy',
      },
      {
        label: 'Tulip',
        value: 'Tulip',
      },
    ],
  },
  render: (currentArgs) => <RadioGroup {...currentArgs} />,
};

export const LabelOverflow: Story = {
  args: {
    options: [
      {
        label: 'Cycling around Britany',
        value: 'Cycling around Britany',
      },
      {
        label: 'Discovering forgotten tracks in the Italian Alps',
        value: 'Discovering forgotten tracks in the Italian Alps',
      },
      {
        label: 'Visiting middle age churches',
        value: 'Visiting middle age churches',
      },
    ],
  },
  render: (currentArgs) => <RadioGroup {...currentArgs} />,
};

export const RequiredRadioButton: Story = {
  args: {
    label: 'Choose a flavour',
    required: true,
    options: buildFruitsOptions('required'),
  },
  render: (currentArgs) => <RadioGroup {...currentArgs} />,
};

export const InfoRadioButton: Story = {
  args: {
    options: buildFruitsOptions('info'),
    statusWithMessage: {
      status: 'info',
      message: 'We made this choice for you',
    },
  },
  render: (currentArgs) => <RadioGroup {...currentArgs} />,
};

export const WarningRadioButton: Story = {
  args: {
    label: 'With your beverage',
    required: true,
    options: [
      {
        label: 'Milk',
        value: 'Milk',
      },
      {
        label: 'Sugar',
        value: 'Sugar',
      },
      {
        label: 'Lemon slice',
        value: 'Lemon slice',
      },
    ],
    statusWithMessage: {
      status: 'warning',
      message: 'Lemon and coffee is a rare match',
    },
  },
  render: (currentArgs) => <RadioGroup {...currentArgs} />,
};

export const ErrorRadioButton: Story = {
  args: {
    options: [
      {
        label: 'Parsley',
        value: 'Parsley',
      },
      {
        label: 'Chives',
        value: 'Chives',
      },
      {
        label: 'Garlic',
        value: 'Garlic',
      },
    ],
    statusWithMessage: {
      status: 'error',
      message: 'The Chef refuses to cook omelettes with garlic',
    },
  },
  render: (currentArgs) => <RadioGroup {...currentArgs} />,
};
