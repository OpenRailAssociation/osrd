import React, { useState } from 'react';

import {
  Button,
  CheckboxesTree,
  ComboBox,
  DatePicker,
  Input,
  PasswordInput,
  RadioGroup,
  Select,
  TextArea,
  TolerancePicker,
  type StatusWithMessage,
} from '@osrd-project/ui-core';
import { Clear, Check } from '@osrd-project/ui-icons';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { noop } from 'lodash';

import '@osrd-project/ui-core/dist/theme.css';

const FormComponent = (fieldProps: {
  required: boolean;
  disabled: boolean;
  readonly: boolean;
  narrow: boolean;
  small: boolean;
  hint?: string;
  statusWithMessage?: StatusWithMessage;
  statusIconPosition?: 'next-to-field' | 'before-status-message';
}) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<Record<string, any>>({});
  return (
    <form
      id="form"
      style={{ display: 'grid', gap: '0.5rem' }}
      onSubmit={(e) => {
        e.preventDefault();
      }}
    >
      <Input
        id="text"
        label="Input text"
        type="text"
        value={data.text}
        onChange={(e) => setData((prev) => ({ ...prev, text: e.target.value }))}
        {...fieldProps}
      />
      <Input
        id="text-with-icons"
        label="Input text with icons"
        type="text"
        value={data.textWithIcons}
        withIcons={[
          { action: noop, icon: <Check /> },
          { action: noop, icon: <Clear /> },
        ]}
        onChange={(e) => setData((prev) => ({ ...prev, textWithIcons: e.target.value }))}
        {...fieldProps}
      />
      <Input
        id="text-with-contents"
        label="Input text with trailing & leading content"
        type="text"
        value={data.textWithContents}
        leadingContent={{ content: 'Lorem ipsum', onClickCallback: noop }}
        trailingContent={{ content: 'Lorem ipsum', onClickCallback: noop }}
        withIcons={[
          { action: noop, icon: <Check /> },
          { action: noop, icon: <Clear /> },
        ]}
        onChange={(e) => setData((prev) => ({ ...prev, textWithContents: e.target.value }))}
        {...fieldProps}
      />
      <ComboBox
        id="combobox"
        label="Combo box"
        value={data.combobox}
        onChange={(newValue) => setData((prev) => ({ ...prev, combobox: newValue }))}
        suggestions={['Group DDDEEEFFF', 'Group AAABBBCCC', 'Group GGGHHHIII']}
        getSuggestionLabel={(e) => e}
        onSelectSuggestion={noop}
        resetSuggestions={noop}
        {...fieldProps}
      />
      <Select
        id="select"
        label="Select "
        value={data.select}
        onChange={(e) => setData((prev) => ({ ...prev, select: e }))}
        getOptionLabel={(e) => `${e}`}
        getOptionValue={(e) => `${e}`}
        options={['Group DDDEEEFFF', 'Group AAABBBCCC', 'Group GGGHHHIII']}
        {...fieldProps}
      />
      <TextArea
        id="textarea"
        label="Textarea"
        value={data.textarea}
        onChange={(e) => setData((prev) => ({ ...prev, textarea: e.target.value }))}
        {...fieldProps}
      />
      <PasswordInput
        id="password"
        label="Password"
        value={data.password}
        onChange={(e) => setData((prev) => ({ ...prev, password: e.target.value }))}
        {...fieldProps}
      />
      <RadioGroup
        label="Your favorite color"
        value={data.radiogroup}
        onChange={(e) => setData((prev) => ({ ...prev, radiogroup: e }))}
        options={[
          { label: 'Red', value: '#FF0000' },
          { label: 'Green', value: '#00FF00' },
          { label: 'Blue', value: '#0000FF' },
        ]}
        {...fieldProps}
      />

      <CheckboxesTree
        id="checkboxesTree"
        label="Your favorites colors"
        onChange={(e) => setData((prev) => ({ ...prev, checkboxesTree: e }))}
        items={
          data.checkboxesTree || [
            {
              id: 1,
              props: { label: 'Dark', value: 'dark', ...fieldProps },
              items: [
                { id: 11, props: { label: 'Red', value: '#FF0000', ...fieldProps } },
                { id: 12, props: { label: 'Black', value: '#000000', ...fieldProps } },
              ],
            },
            {
              id: 2,
              props: { label: 'Light', value: 'light' },
              items: [
                { id: 21, props: { label: 'Green', value: '#00FF00', ...fieldProps } },
                { id: 22, props: { label: 'Blue', value: '#0000FF', ...fieldProps } },
              ],
            },
          ]
        }
        {...fieldProps}
      />

      <TolerancePicker
        id="tolerance"
        label="Tolerance"
        onToleranceChange={(e) => setData((prev) => ({ ...prev, tolerance: e }))}
        toleranceValues={data.tolerance || { minusTolerance: 0, plusTolerance: 0 }}
        {...fieldProps}
      />

      <DatePicker
        value={data.datepicker || new Date()}
        onDateChange={(e) => setData((prev) => ({ ...prev, datepicker: e }))}
        inputProps={{ id: 'datepicker', label: 'Date picker', ...fieldProps }}
      />

      <DatePicker
        isRangeMode={true}
        value={data.datepickerRange || { start: new Date(), end: new Date() }}
        onDateChange={(_, e) => setData((prev) => ({ ...prev, datepickerRange: e }))}
        inputProps={{ id: 'daterangepicker', label: 'Date range picker', ...fieldProps }}
      />

      <div style={{ padding: '1rem' }}>
        <Button label="Submit" onClick={noop} />
      </div>
    </form>
  );
};

const meta: Meta<typeof FormComponent> = {
  component: FormComponent,
  title: 'Core/Form',
  tags: ['autodocs'],
  args: {
    required: true,
    disabled: false,
    readonly: false,
    narrow: false,
    small: false,
    hint: 'A very import help message',
    statusWithMessage: { status: 'error', message: 'Bad format' },
    statusIconPosition: 'before-status-message',
  },
};

export default meta;
type Story = StoryObj<typeof FormComponent>;

export const Default: Story = {
  name: 'Form',
  args: {},
  parameters: {},
};
