import React from 'react';
import { ComponentStory, ComponentMeta } from '@storybook/react';
import SpeedSpaceChart from 'applications/osrd/components/Simulation/SpeedSpaceChart/SpeedSpaceChart';

export default {
    /* 👇 The title prop is optional.
    * See https://storybook.js.org/docs/react/configure/overview#configure-story-loading
    * to learn how to generate automatic titles
    */
    title: 'SpeedSpaceChart',
    component: SpeedSpaceChart,
  };

  const Template: ComponentStory<typeof SpeedSpaceChart> = (args) => <SpeedSpaceChart {...args} />;

export const Base = Template.bind({});