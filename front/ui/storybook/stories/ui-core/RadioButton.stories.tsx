import { RadioButton } from '@osrd-project/ui-core';
import { type StoryObj, type Meta } from '@storybook/react-vite';

import '@osrd-project/ui-core/dist/theme.css';

const meta: Meta<typeof RadioButton> = {
  component: RadioButton,
  args: {
    label: 'One way or the other',
    value: 'option',
  },
  title: 'Core/RadioButton',
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof RadioButton>;

export const Default: Story = {
  args: {
    label: 'One way or the other',
    value: 'option',
    hint: 'Choice is good',
    small: false,
    disabled: false,
  },
};
