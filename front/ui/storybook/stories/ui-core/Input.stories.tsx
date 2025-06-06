import React, { useState } from 'react';

import { Input, type StatusWithMessage } from '@osrd-project/ui-core';
import { ChevronDown, X } from '@osrd-project/ui-icons';
import type { Meta, StoryObj } from '@storybook/react-vite';
import '@osrd-project/ui-core/dist/theme.css';

const meta: Meta<typeof Input> = {
  component: Input,
  args: {
    small: false,
    disabled: false,
    readOnly: false,
    narrow: false,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: '20rem' }}>
        <Story />
      </div>
    ),
  ],
  title: 'Core/Input',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    label: 'Your name',
    type: 'text',
  },
};

export const Value: Story = {
  args: {
    label: 'Your name',
    type: 'text',
    value: 'Manuel',
  },
};

export const Hint: Story = {
  args: {
    label: 'Your name',
    type: 'text',
    value: 'Manuel',
    hint: "It doesn't have to be real",
  },
};

export const LeadingContent: Story = {
  args: {
    label: 'Price',
    type: 'number',
    leadingContent: '£',
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: '10rem' }}>
        <Story />
      </div>
    ),
  ],
};

export const TrainlingContent: Story = {
  args: {
    label: 'Price',
    type: 'number',
    trailingContent: '€',
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: '10rem' }}>
        <Story />
      </div>
    ),
  ],
};

export const LeadingAndTrainlingContent: Story = {
  args: {
    label: 'Price',
    type: 'number',
    leadingContent: 'Minimum',
    trailingContent: 'Km/h',
  },
};

export const RequiredInput: Story = {
  args: {
    label: 'Your name',
    type: 'text',
    required: true,
  },
};

export const LoadingInput: Story = {
  args: {
    label: 'Name',
    type: 'text',
    required: true,
    value: 'Manuel',
    statusWithMessage: {
      status: 'loading',
    },
  },
};

export const SuccessInput: Story = {
  args: {
    label: 'Your name',
    type: 'text',
    required: true,
    value: 'jean-michel.halleurt@exemple.fr',
    statusWithMessage: {
      status: 'success',
    },
  },
};

export const InformationInput: Story = {
  args: {
    label: 'Name',
    type: 'text',
    required: true,
    value: 'Jean-Michel Halleurt',
    statusWithMessage: {
      status: 'info',
      message: 'You won’t be able to change it',
    },
  },
};

export const WarningInput: Story = {
  args: {
    label: 'Your name',
    type: 'text',
    required: true,
    value: 'Jean-Michel Halleurt',
    statusWithMessage: {
      status: 'warning',
      message: 'Don’t be a troll, please',
    },
  },
};

export const WarningWithoutMessageInput: Story = {
  args: {
    label: 'Your name',
    type: 'text',
    required: true,
    value: 'Jean-Michel Halleurt',
    statusWithMessage: {
      status: 'warning',
    },
  },
};

export const ErrorInput: Story = {
  args: {
    label: 'Name',
    type: 'text',
    required: true,
    value: 'Michel Sardou',
    statusWithMessage: {
      status: 'error',
      message: '“Michel Sardou” can’t be used',
    },
  },
};

export const TooltipErrorInput: Story = {
  args: {
    label: 'Name',
    type: 'text',
    required: true,
    value: 'Michel Sardou',
    statusWithMessage: {
      tooltip: 'right',
      status: 'error',
      message: '“Michel Sardou” can’t be used',
    },
  },
};

export const TooltipWarningNarrowInput: Story = {
  args: {
    label: 'Name',
    type: 'text',
    value: 'This is a narrow input',
    statusWithMessage: {
      status: 'warning',
      message:
        "My wrapper doesn't have any padding. Don't use me with 'required' or 'statusWithMessage' with no tooltip.",
    },
    narrow: true,
  },
};

export const TooltipInfoInput: Story = {
  args: {
    label: 'Name',
    type: 'text',
    required: true,
    value: 'Michel Sardou',
  },
  decorators: [
    function Component(Story, ctx) {
      const [status, setStatus] = useState<StatusWithMessage | undefined>({
        tooltip: 'right',
        status: 'info',
        message: '“Michel Sardou” can’t be used',
      });
      return (
        <Story
          args={{
            ...ctx.args,
            statusWithMessage: status,
            onCloseStatusMessage: () => setStatus(undefined),
          }}
        />
      );
    },
  ],
};

export const TwoTooltipErrorInput: Story = {
  decorators: [
    (Story) => (
      <div style={{ display: 'flex', flexDirection: 'row', gap: '20px' }}>
        <Story
          args={{
            label: 'Name',
            type: 'text',
            value: 'Michel Sardou',
            statusWithMessage: {
              tooltip: 'left',
              status: 'error',
              message: 'Michel Sardou can’t be used',
            },
          }}
        />
        <Story
          args={{
            label: 'Name',
            type: 'text',
            value: 'Jean-Michel Halleurt',
            statusWithMessage: {
              tooltip: 'right',
              status: 'error',
              message: 'Jean-Michel Halleurt can’t be used',
            },
          }}
        />
      </div>
    ),
  ],
};

export const ErrorWithoutMessageInput: Story = {
  args: {
    label: 'Name',
    type: 'text',
    required: true,
    value: 'Michel Sardou',
    statusWithMessage: {
      status: 'error',
    },
  },
};

export const InputWithChevronButton: Story = {
  args: {
    label: 'Your name',
    type: 'text',
    value: 'Manuel',
    withIcons: [
      {
        icon: <ChevronDown size="lg" />,
        action: () => {},
        className: 'chevron-icon',
      },
    ],
  },
};

export const InputWithClearButton: Story = {
  args: {
    label: 'Your name',
    type: 'text',
    value: 'Hubert Blaine Wolfeschlegelsteinhausenbergerdorff Sr',
    withIcons: [
      {
        icon: <X size="lg" />,
        action: () => {},
        className: 'chevron-icon',
      },
    ],
  },
};

export const InputWithTwoIconAndLongValue: Story = {
  args: {
    label: 'Your name',
    type: 'text',
    value: 'Hubert Blaine Wolfeschlegelsteinhausenbergerdorff Sr',
    withIcons: [
      {
        icon: <X size="lg" />,
        action: () => {},
        className: 'chevron-icon',
      },
      {
        icon: <ChevronDown size="lg" />,
        action: () => {},
        className: 'chevron-icon',
      },
    ],
  },
};
