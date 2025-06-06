import React from 'react';

import { Select, type SelectProps } from '@osrd-project/ui-core';
import { type StoryObj, type Meta } from '@storybook/react-vite';

import '@osrd-project/ui-core/dist/theme.css';

type Option = { value: string; label: string };

const options = [
  { value: 'blue', label: 'Blue' },
  { value: 'red', label: 'Red' },
  { value: 'green', label: 'Green' },
] as Option[];

const SelectWrapper = (props: SelectProps<Option>) => <Select {...props} />;

const meta: Meta<typeof SelectWrapper> = {
  component: SelectWrapper,
  args: {
    label: 'Fill colour',
    placeholder: 'Choose',
    value: options[0],
    options,
    getOptionLabel: (option: Option) => option.label,
    getOptionValue: (option: Option) => option.value,
    // eslint-disable-next-line no-console
    onChange: (option?: Option) => console.log(option),
    small: false,
    disabled: false,
    readOnly: false,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: '20rem' }}>
        <Story />
      </div>
    ),
  ],
  title: 'Core/Select',
  tags: ['autodocs'],
};

export default meta;

type StoryType = StoryObj<typeof SelectWrapper>;

export const Default: StoryType = {
  args: {
    id: 'Default',
    value: undefined,
  },
};

export const Narrow: StoryType = {
  args: {
    id: 'Narrow',
    value: undefined,
    narrow: true,
  },
};

export const LongText: StoryType = {
  args: {
    id: 'LongText',
    value: undefined,
    placeholder: 'Very very very very very very long placeholder',
    options: [
      { value: 'blue', label: 'Blue' },
      { value: 'long_value', label: 'Very very very very very very long value' },
    ],
  },
};

export const SelectedOption: StoryType = {
  args: {
    id: 'SelectedOption',
    value: options[1],
  },
};

export const Hint: StoryType = {
  args: {
    id: 'Hint',
    hint: 'This is not a choice',
  },
};

export const RequiredInput: StoryType = {
  args: {
    id: 'RequiredInput',
    required: true,
  },
};

export const InformationSelect: StoryType = {
  args: {
    id: 'InformationSelect',
    required: true,
    statusWithMessage: {
      status: 'info',
      message: 'This is a one way choice',
    },
  },
};

export const WarningSelect: StoryType = {
  args: {
    id: 'WarningSelect',
    required: true,
    statusWithMessage: {
      status: 'warning',
    },
  },
};

export const WarningWithMessageSelect: StoryType = {
  args: {
    id: 'WarningWithMessageSelect',
    required: true,
    statusWithMessage: {
      status: 'warning',
      message: 'This is a one way choice',
    },
  },
};

export const ErrorSelect: StoryType = {
  args: {
    id: 'ErrorSelect',
    required: true,
    statusWithMessage: {
      status: 'error',
    },
  },
};

export const ErrorWithMessageSelect: StoryType = {
  args: {
    id: 'ErrorWithMessageSelect',
    required: true,
    statusWithMessage: {
      status: 'error',
      message: 'This is a one way choice',
    },
  },
};
