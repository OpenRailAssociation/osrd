import React, { useEffect, useState } from 'react';

import '@osrd-project/ui-core/dist/theme.css';
import '@osrd-project/ui-charts/dist/theme.css';
import { SpeedSpaceChart, type SpeedSpaceChartProps } from '@osrd-project/ui-charts';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { pathPropertiesPmpLm } from './assets/path_properties_PMP_LM';
import { powerRestrictionsPmpLm } from './assets/power_restrictions_PMP_LM';
import { simulationPmpLm } from './assets/simulation_PMP_LM';
import { speedLimitTags } from './assets/speed_limit_tags_PMP_LM';
import { defaultTranslations } from './consts';
import { formatData } from './utils';

const defaultData = formatData(
  simulationPmpLm,
  pathPropertiesPmpLm,
  powerRestrictionsPmpLm,
  speedLimitTags
);

const SpeedSpaceChartStory = ({
  height,
  width,
  backgroundColor,
  data,
  translations,
}: SpeedSpaceChartProps) => {
  const [containerHeight, setContainerHeight] = useState(460);

  useEffect(() => {
    setContainerHeight(height);
  }, [height]);

  return (
    <div style={{ height: containerHeight }}>
      <SpeedSpaceChart
        width={width}
        height={containerHeight}
        backgroundColor={backgroundColor}
        data={data}
        setHeight={setContainerHeight}
        translations={translations}
      />
    </div>
  );
};

const meta: Meta<typeof SpeedSpaceChart> = {
  title: 'SpeedSpaceChart/Rendering',
  component: SpeedSpaceChart,
  decorators: [(Story) => <Story />],
  args: {
    width: 1440,
    height: 521.5,
    backgroundColor: 'rgb(247, 246, 238)',
    data: defaultData,
    setHeight: () => {},
    translations: defaultTranslations,
  },

  render: (args) => <SpeedSpaceChartStory {...args} />,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof SpeedSpaceChart>;

export const SpeedSpaceChartDefault: Story = {
  args: {
    width: 1440,
    height: 521.5,
    backgroundColor: 'rgb(247, 246, 238)',
    data: defaultData,
    setHeight: () => {},
    translations: defaultTranslations,
  },
};
