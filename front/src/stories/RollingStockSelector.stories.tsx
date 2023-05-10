import React from 'react';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import RollingStockSelector from 'common/RollingStockSelector/RollingStockSelector';
import { OSRD_ROLLINGSTOCKSELECTED_SAMPLE_DATA } from 'applications/operationalStudies/components/SimulationResults/SpeedSpaceChart/sampleData';
import { RollingStock } from 'common/api/osrdEditoastApi';
import exampleRollingStockImage1 from 'assets/defaultRSImages/example_rolling_stock_image_1.gif';
import exampleRollingStockImage2 from 'assets/defaultRSImages/example_rolling_stock_image_2.gif';

export default {
  title: 'Common/RollingStockSelector',
  component: RollingStockSelector,
} as ComponentMeta<typeof RollingStockSelector>;

const Template: ComponentStory<typeof RollingStockSelector> = (args) => (
  <div className="w-50">
    <RollingStockSelector {...args} />
  </div>
);

const image = (
  <>
    <img src={exampleRollingStockImage1} alt="rollingStockHead" />
    <img src={exampleRollingStockImage2} alt="rollingStockTail" />
  </>
);

export const EmptyRollingStockSelector = Template.bind({});
EmptyRollingStockSelector.args = {
  choice: 'Choose a rollingstock',
};

export const NotCondensedRollingStockSelector = Template.bind({});
NotCondensedRollingStockSelector.args = {
  condensed: false,
  rollingStockComfort: 'HEATING',
  rollingStockSelected: OSRD_ROLLINGSTOCKSELECTED_SAMPLE_DATA as RollingStock,
  image,
  comfort: 'Comfort',
  comfortType: 'Heating',
};

export const CondensedRollingStockSelector = Template.bind({});
CondensedRollingStockSelector.args = {
  condensed: true,
  rollingStockComfort: 'HEATING',
  rollingStockSelected: OSRD_ROLLINGSTOCKSELECTED_SAMPLE_DATA as RollingStock,
  image,
  comfort: 'Comfort',
  comfortType: 'Heating',
};
