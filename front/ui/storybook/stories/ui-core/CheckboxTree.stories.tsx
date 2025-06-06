import React, { useState } from 'react';

import {
  CheckboxesTree,
  type CheckboxesTreeProps,
  type CheckboxTreeItem,
} from '@osrd-project/ui-core';
import type { Meta, StoryObj } from '@storybook/react-vite';

import '@osrd-project/ui-core/dist/theme.css';

const CheckboxesTreeStory = (props: CheckboxesTreeProps) => {
  const [items, setItems] = useState<CheckboxTreeItem[]>(props.items);
  const onChange = (newItems: CheckboxTreeItem[]) => setItems(newItems);
  return <CheckboxesTree {...props} items={items} onChange={onChange} />;
};

const meta: Meta<typeof CheckboxesTree> = {
  component: CheckboxesTree,
  title: 'Core/CheckboxesTree',
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    small: { control: 'boolean' },
    readOnly: { control: 'boolean' },
    required: { control: 'boolean' },
  },
  render: (props) => <CheckboxesTreeStory {...props} />,
};

export default meta;
type Story = StoryObj<typeof CheckboxesTree>;

const milkButterCream = [
  { id: 1, props: { label: 'Milk' } },
  { id: 2, props: { label: 'Butter' } },
  { id: 3, props: { label: 'Cream' } },
];

const milkSugarLemon = [
  { id: 1, props: { label: 'Milk' } },
  { id: 2, props: { label: 'Sugar' } },
  { id: 3, props: { label: 'Lemon slice' } },
];

export const Default: Story = {
  args: {
    items: milkButterCream,
  },
};

export const GroupWithLabel: Story = {
  args: {
    items: milkSugarLemon,
    label: 'With your tea',
  },
};

export const GroupWithLabelCaption: Story = {
  args: {
    items: milkSugarLemon,
    label: 'With your tea',
    hint: 'At no extra cost for you',
  },
};

export const LabelOverflow: Story = {
  args: {
    items: [
      { id: 1, props: { label: 'A walk on the beach' } },
      { id: 2, props: { label: 'A bike ride on long forest winding roads' } },
      { id: 3, props: { label: 'Reading a book in a couch' } },
    ],
  },
};

export const Nested: Story = {
  args: {
    items: [
      {
        id: 0,
        props: { label: 'Dairy products' },
        items: [
          { id: 1, props: { label: 'Milk' } },
          { id: 2, props: { label: 'Butter' } },
          { id: 3, props: { label: 'Cream' } },
        ],
      },
    ],
  },
};

export const MoreNested: Story = {
  args: {
    items: [
      {
        id: 1,
        props: { label: 'foo' },
        items: [
          {
            id: 2,
            props: { label: 'foo2' },
            items: [
              { id: 3, props: { label: 'foo3' } },
              { id: 4, props: { label: 'foo4' } },
            ],
          },
          {
            id: 5,
            props: { label: 'foo5' },
            items: [
              {
                id: 6,
                props: { label: 'foo6' },
                items: [
                  { id: 8, props: { label: 'foo8' } },
                  { id: 9, props: { label: 'foo9' } },
                ],
              },
            ],
          },
        ],
      },
      { id: 7, props: { label: 'foo7' } },
    ],
  },
};

export const Required: Story = {
  args: {
    items: milkSugarLemon,
    label: 'With your beverage',
    required: true,
  },
};

export const Information: Story = {
  args: {
    items: milkButterCream.map((item, index) =>
      index === 1 ? { ...item, props: { ...item.props, checked: true } } : { ...item }
    ),
    disabled: true,
    statusWithMessage: { status: 'info', message: 'These controls are disabled' },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: '20rem' }}>
        <Story />
      </div>
    ),
  ],
};

export const Warning: Story = {
  args: {
    items: milkSugarLemon,
    statusWithMessage: {
      status: 'warning',
      message: 'Your tea will be black, strong and not sweet at all',
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: '20rem' }}>
        <Story />
      </div>
    ),
  ],
};

export const Error: Story = {
  args: {
    items: [
      { id: 1, props: { label: 'Chocolate cake' } },
      { id: 2, props: { label: 'Ice cream' } },
      { id: 3, props: { label: 'Tiramisu' } },
    ],
    statusWithMessage: {
      status: 'error',
      message: 'You can’t order a meal without a pastry',
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: '20rem' }}>
        <Story />
      </div>
    ),
  ],
};
