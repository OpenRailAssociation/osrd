import React from 'react';

import {
  Button,
  Checkbox,
  ComboBox,
  Input,
  PasswordInput,
  RadioButton,
  Select,
  TextArea,
} from '@osrd-project/ui-core';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { noop } from 'lodash';

import '@osrd-project/ui-core/dist/theme.css';

const FormComponent = () => (
  <form id="form">
    <Input id="variant" label="Variant name" type="text" defaultValue="Variant 003004" />
    <ComboBox
      id="parent"
      label="Father train group"
      value="Group DDDEEEFFF"
      suggestions={['Group DDDEEEFFF', 'Group AAABBBCCC']}
      getSuggestionLabel={(e) => e}
      onSelectSuggestion={noop}
      resetSuggestions={noop}
    />
    <Select
      id="parent2"
      label="Mother train group "
      value="Group DDDEEEFFF"
      getOptionLabel={(e) => `${e}`}
      getOptionValue={(e) => `${e}`}
      options={['Group DDDEEEFFF', 'Group AAABBBCCC']}
      onChange={noop}
    />
    <TextArea id="description" label="Variant description" value="Testing more trains upstream" />
    <PasswordInput id="password" label="Password" />
    <div style={{ padding: '1rem', display: 'flex', gap: '1rem' }}>
      <RadioButton name="color" label="Red" value="#FF0000" />
      <RadioButton name="color" label="Green" value="#00FF00" />
      <RadioButton name="color" label="Blue" value="#0000FF" />
    </div>
    <div style={{ padding: '1rem' }}>
      <Checkbox label="Checkbox" />
    </div>

    <div style={{ padding: '1rem' }}>
      <Button label="Submit" onClick={noop} />
    </div>
  </form>
);

const meta: Meta<typeof FormComponent> = {
  component: FormComponent,
  title: 'Core/Form',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof FormComponent>;

export const Default: Story = {
  name: 'Form',
  args: {},
  parameters: {},
};
