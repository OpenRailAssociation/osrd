import React from 'react';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import DisplayMissingInfo from '../common/DisplayMissingInfo/DisplayMissingInfo';

export default {
  title: 'Warning/DisplayMissingInfo',
  component: DisplayMissingInfo,
} as ComponentMeta<typeof DisplayMissingInfo>;

const Template: ComponentStory<typeof DisplayMissingInfo> = (args) => (
  <DisplayMissingInfo {...args} />
);

export const ActiveDisplayMissingInfo = Template.bind({});
ActiveDisplayMissingInfo.args = {
  title: 'missing informations',
  missingInfoList: [
    'first info is missing',
    'second info is missing',
    'third info is missing',
    'fourth info is missing',
  ],
  isShowing: true,
  isCorrect: true,
};
