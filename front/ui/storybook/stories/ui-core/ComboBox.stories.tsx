import React, { useState } from 'react';

import { ComboBox, useDefaultComboBox } from '@osrd-project/ui-core';
import type { Meta, StoryObj } from '@storybook/react-vite';

import '@osrd-project/ui-core/dist/theme.css';

type Suggestion = { id: string; label: string };

const suggestions = [
  { id: '1', label: 'Manuel' },
  { id: '2', label: 'Consuela' },
  { id: '3', label: 'Juan' },
  { id: '4', label: 'Manolo' },
  { id: '5', label: 'Maria' },
  { id: '6', label: 'Jose' },
  { id: '7', label: 'Ana' },
  { id: '8', label: 'Pedro' },
  { id: '9', label: 'Lucia' },
  { id: '10', label: 'Carlos' },
  { id: '11', label: 'Elena' },
  { id: '12', label: 'Miguel' },
] as Suggestion[];

const ComboBoxStory = (props: { small?: boolean; disabled?: boolean; readOnly?: boolean }) => {
  const [value, setValue] = useState<Suggestion>();

  const getSuggestionLabel = (suggestion: Suggestion) => suggestion.label;

  const onSelectSuggestion = (suggestion?: Suggestion) => {
    setValue(suggestion);
  };

  const comboBoxDefaultProps = useDefaultComboBox(suggestions, getSuggestionLabel);

  return (
    <div style={{ maxWidth: '20rem' }}>
      <ComboBox
        id="combo-box-custom"
        value={value}
        getSuggestionLabel={getSuggestionLabel}
        onSelectSuggestion={onSelectSuggestion}
        {...comboBoxDefaultProps}
        {...props}
      />
    </div>
  );
};

const meta: Meta<typeof ComboBoxStory> = {
  component: ComboBoxStory,
  args: {
    small: false,
    disabled: false,
    readOnly: false,
  },
  render: (props) => <ComboBoxStory {...props} />,
  title: 'core/ComboBox',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ComboBox>;

export const Default: Story = {
  args: {
    label: 'Your name',
    type: 'text',
    narrow: false,
  },
};

export const Narrow: Story = {
  args: {
    label: 'Your name',
    type: 'text',
    narrow: true,
  },
};

export const LongText: Story = {
  args: {
    label: 'Your name',
    type: 'text',
    suggestions: [
      { id: '1', label: 'Very very very very very very long value 1' },
      { id: '2', label: 'Very very very very very very long value 2' },
    ],
    value: { id: '1', label: 'Very very very very very very long value 1' },
  },
};

export const WithDefaultValue: Story = {
  args: {
    label: 'Your name',
    type: 'text',
    value: { id: '4', label: 'Manolo' },
  },
};

export const Disabled: Story = {
  args: {
    label: 'Your name',
    type: 'text',
    disabled: true,
  },
};

export const Hint: Story = {
  args: {
    label: 'Your name',
    type: 'text',
    hint: 'You can type Manu to have suggestions',
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
    statusWithMessage: {
      status: 'loading',
    },
  },
};

export const SmallInput: Story = {
  args: {
    label: 'Name',
    type: 'text',
    required: true,
    small: true,
  },
};
