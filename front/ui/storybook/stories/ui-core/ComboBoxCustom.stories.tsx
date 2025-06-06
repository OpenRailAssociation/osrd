import React, { useState } from 'react';

import { ComboBox } from '@osrd-project/ui-core';
import { type StoryObj, type Meta } from '@storybook/react-vite';

import '@osrd-project/ui-core/dist/theme.css';
import './stories.css';

type Suggestion = { id: string; firstname: string; lastname: string };

const suggestions: Suggestion[] = [
  { id: '1', firstname: 'Manuel', lastname: 'Garcia' },
  { id: '2', firstname: 'Consuela', lastname: 'Rodriguez' },
  { id: '3', firstname: 'Juan', lastname: 'Gonzales' },
  { id: '4', firstname: 'Manolo', lastname: 'Fernandez' },
  { id: '5', firstname: 'Maria', lastname: 'Lopez' },
  { id: '6', firstname: 'Jose', lastname: 'Martinez' },
  { id: '7', firstname: 'Ana', lastname: 'Sanchez' },
  { id: '8', firstname: 'Pedro', lastname: 'Perez' },
  { id: '9', firstname: 'Lucia', lastname: 'Gomez' },
  { id: '10', firstname: 'Carlos', lastname: 'Martin' },
  { id: '11', firstname: 'Elena', lastname: 'Jimenez' },
  { id: '12', firstname: 'Miguel', lastname: 'Ruiz' },
];

const ComboBoxStory = () => {
  const [value, setValue] = useState<Suggestion>();
  const [filteredSuggestions, setFilteredSuggestions] = useState<Suggestion[]>(suggestions);

  const getSuggestionLabel = (suggestion: Suggestion) =>
    `${suggestion.firstname} ${suggestion.lastname}`;

  const onSelectSuggestion = (suggestion?: Suggestion) => {
    setValue(suggestion);
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value.toLowerCase();
    if (!inputValue) {
      setFilteredSuggestions(suggestions);
      return;
    }
    setFilteredSuggestions(
      suggestions.filter((suggestion) => suggestion.lastname.toLowerCase().startsWith(inputValue))
    );
  };

  const resetSuggestions = () => {
    setFilteredSuggestions(suggestions);
  };

  return (
    <div style={{ maxWidth: '20rem' }}>
      <p style={{ textAlign: 'center' }}>
        This comboBox filters on the last name using the OnChange props and not the
        filterSuggestions props
      </p>
      <ComboBox
        id="combo-box-custom"
        value={value}
        suggestions={filteredSuggestions}
        getSuggestionLabel={getSuggestionLabel}
        onSelectSuggestion={onSelectSuggestion}
        resetSuggestions={resetSuggestions}
        onChange={onChange}
      />
    </div>
  );
};

const meta: Meta<typeof ComboBoxStory> = {
  component: ComboBoxStory,
  parameters: {
    docs: {
      story: {
        height: '500px',
      },
    },
  },
  args: {},
  title: 'core/ComboBox',
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof ComboBox>;

export const CustomBehavior: Story = {
  args: {},
};
