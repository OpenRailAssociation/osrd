import type { Meta, StoryObj } from '@storybook/react';
import { SearchIcons } from './SearchIcons';

const meta: Meta<typeof SearchIcons> = {
  component: SearchIcons,
  title: 'Icons/SearchIcons',
  tags: ['autodocs'],
  argTypes: {
    size: {
      description: 'Choose the size of the icon',
      options: ['sm', 'lg'],
      control: { type: 'radio' },
    },
    variant: {
      description: 'Does the icon should be filled',
      options: ['base', 'fill'],
      control: { type: 'radio' },
    },
    iconColor: {
      description: 'Choose the color of the font',
      control: { type: 'color' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SearchIcons>;

export const Default: Story = {
  name: 'Icons search',
  args: {
    size: 'lg',
    variant: 'base',
    iconColor: '#000',
  },
  parameters: {},
};
