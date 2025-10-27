import React, { useState } from 'react';

import { TextArea } from '@osrd-project/ui-core';
import { type Meta, type StoryObj, type Decorator } from '@storybook/react-vite';

import '@osrd-project/ui-core/dist/theme.css';

const withControlledValue: Decorator = (Story, ctx) => {
  const [value, setValue] = useState<string>(String(ctx.args.value ?? ''));
  return (
    <Story
      args={{
        ...ctx.args,
        value,
        onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setValue(e.target.value),
      }}
    />
  );
};

const meta: Meta<typeof TextArea> = {
  component: TextArea,
  args: {
    disabled: false,
    readOnly: false,
    label: 'Description',
  },
  decorators: [
    withControlledValue,
    (Story) => (
      <div style={{ maxWidth: 'fit-content' }}>
        <Story />
      </div>
    ),
  ],
  title: 'Core/TextArea',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof TextArea>;

export const Value: Story = {
  args: {
    value: 'The light you see is this end of the tunnel.',
  },
};

export const Hint: Story = {
  args: {
    hint: 'Be precise and succinct',
  },
};

export const Counter: Story = {
  args: {
    maxLength: 220,
  },
};

export const RequiredTextArea: Story = {
  args: {
    required: true,
  },
};

export const SuccessTextArea: Story = {
  args: {
    value: 'A good looking red train.',
    statusWithMessage: {
      status: 'success',
    },
  },
};

export const InformationTextArea: Story = {
  args: {
    statusWithMessage: {
      status: 'info',
      message: 'You won’t be able to change it',
    },
  },
};

export const WarningTextArea: Story = {
  args: {
    value: 'Blah blah blah',
    statusWithMessage: {
      status: 'warning',
      message: 'Please make it useful',
    },
  },
};

export const WarningWithoutMessageTextArea: Story = {
  args: {
    value: 'Blah blah blah',
    statusWithMessage: {
      status: 'warning',
    },
  },
};

export const ErrorTextArea: Story = {
  args: {
    value: '^pcds^qpdc^plsqd ^cpl qs^dpcl ^`pqsld c^`pl q',
    statusWithMessage: {
      status: 'error',
      message: 'This doesn’t make sense',
    },
  },
};

export const ErrorWithoutMessageTextArea: Story = {
  args: {
    value: '^pcds^qpdc^plsqd ^cpl qs^dpcl ^`pqsld c^`pl q',
    statusWithMessage: {
      status: 'error',
    },
  },
};
