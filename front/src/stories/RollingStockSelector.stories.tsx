import React from 'react';
import { Meta } from '@storybook/react';
import { RollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector';
import ROLLING_STOCK_SAMPLE_DATA from 'modules/rollingStock/components/RollingStockSelector/sampleData';
import { RollingStockComfortType } from 'common/api/osrdEditoastApi';
import exampleRollingStockImage1 from 'assets/defaultRSImages/example_rolling_stock_image_1.gif';
import exampleRollingStockImage2 from 'assets/defaultRSImages/example_rolling_stock_image_2.gif';

export default {
  title: 'Common/RollingStockSelector',
  component: RollingStockSelector,
} as Meta<typeof RollingStockSelector>;

const image = (
  <>
    <img src={exampleRollingStockImage1} alt="rollingStockHead" />
    <img src={exampleRollingStockImage2} alt="rollingStockTail" />
  </>
);

const defaultArgs = {
  rollingStockSelected: ROLLING_STOCK_SAMPLE_DATA,
  rollingStockComfort: 'STANDARD' as RollingStockComfortType,
  image,
};

export const NotCondensedRollingStockSelector = {
  args: {
    ...defaultArgs,
    condensed: false,
  },
};

export const CondensedRollingStockSelector = {
  args: {
    ...defaultArgs,
    condensed: true,
  },
};

export const CondensedRollingStockSelectorWithoutSelectedRollingStock = {
  args: {
    ...defaultArgs,
    condensed: true,
    rollingStockSelected: undefined,
  },
};
