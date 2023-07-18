import React, { useState } from 'react';
import 'stories/storybook.css';

import { LinearMetadataItem, fixLinearMetadataItems } from 'common/IntervalsDataViz/data';
import { notEmpty } from 'common/IntervalsDataViz/utils';
import { IntervalsEditor } from 'common/IntervalsEditor/IntervalsEditor';
import {
  INTERVAL_TYPES,
  IntervalItem,
  IntervalsEditorToolsConfig,
} from 'common/IntervalsEditor/types';

const formDataBase = [
  { begin: 0, end: 6000 },
  { begin: 6000, end: 7000, value: 3 },
  { begin: 7000, end: 8000, value: 6 },
  { begin: 8000, end: 9000, value: 3 },
  { begin: 9000, end: 14000 },
  { begin: 14000, end: 15000, value: -3 },
  { begin: 15000, end: 16000, value: -6 },
  { begin: 16000, end: 17000, value: -3 },
  { begin: 17000, end: 25000 },
];

const formDataBaseCategories = [
  { begin: 0, end: 6000 },
  { begin: 6000, end: 7000, value: 'U3' },
  { begin: 7000, end: 8000, value: 'U5' },
  { begin: 8000, end: 9000, value: 'U4' },
  { begin: 9000, end: 14000 },
  { begin: 14000, end: 15000, value: 'U1' },
  { begin: 15000, end: 16000, value: 'U3' },
  { begin: 16000, end: 17000, value: 'U3' },
  { begin: 17000, end: 25000 },
];

type IntervalsEditorProps = {
  defaultValue: number | string;
  defaultUnit?: string;
  exampleData: IntervalItem[];
  fieldLabel: string;
  intervalType: INTERVAL_TYPES.NUMBER_WITH_UNIT | INTERVAL_TYPES.SELECT;
  toolsConfig?: IntervalsEditorToolsConfig;
  title?: string;
  totalLength: number;
  selectOptions?: string[];
  units: string[];
};

const IntervalsEditorWrapper: React.FC<IntervalsEditorProps> = (props) => {
  const {
    defaultValue,
    exampleData,
    fieldLabel,
    intervalType,
    selectOptions,
    title,
    toolsConfig,
    totalLength,
    units = [],
  } = props;
  const [data, setData] = useState<IntervalItem[]>(
    fixLinearMetadataItems(exampleData.filter(notEmpty), totalLength)
  );

  if (intervalType === INTERVAL_TYPES.NUMBER_WITH_UNIT) {
    return (
      <IntervalsEditor
        {...props}
        data={data as LinearMetadataItem<{ value: number | string; unit: string }>[]}
        defaultValue={defaultValue}
        fieldLabel={fieldLabel}
        intervalType={intervalType}
        setData={setData}
        showValues
        title={title}
        totalLength={totalLength}
        toolsConfig={toolsConfig}
        units={units}
      />
    );
  }
  return (
    <IntervalsEditor
      {...props}
      data={data as LinearMetadataItem<{ value: number | string }>[]}
      defaultValue={defaultValue}
      intervalType={intervalType}
      setData={setData}
      showValues
      title={title}
      totalLength={totalLength}
      toolsConfig={toolsConfig}
      selectOptions={selectOptions || []}
    />
  );
};

export default {
  title: 'Common/IntervalsDemonstrator',
  component: IntervalsEditorWrapper,
  argTypes: {
    onChange: { description: 'Value sent back to wrapper', action: 'onChange' },
  },
};

export const ByContinousValues = {
  args: {
    defaultValue: 5,
    exampleData: formDataBase,
    fieldLabel: 'gradient',
    intervalType: INTERVAL_TYPES.NUMBER_WITH_UNIT,
    title: 'Gradient on path',
    toolsConfig: {
      deleteTool: true,
      translateTool: false,
      cutTool: true,
      addTool: true,
    },
    totalLength: 25000,
    units: ['s', 'm'],
  } as IntervalsEditorProps,
};

export const ByCategories = {
  args: {
    defaultValue: 'U1',
    exampleData: formDataBaseCategories,
    fieldLabel: 'value',
    intervalType: INTERVAL_TYPES.SELECT,
    selectOptions: ['U1', 'U2', 'U3', 'U4', 'U5'],
    title: 'Power restrictions on path',
    toolsConfig: {
      deleteTool: true,
      translateTool: false,
      cutTool: true,
      addTool: true,
    },
    totalLength: 25000,
  } as IntervalsEditorProps,
};
