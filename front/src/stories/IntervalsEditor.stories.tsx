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

const dataNumber = [
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

const dataNumberWithUnit = [
  { begin: 0, end: 6000, unit: 's' },
  { begin: 6000, end: 7000, value: 3, unit: 's' },
  { begin: 7000, end: 8000, value: 6, unit: 's' },
  { begin: 8000, end: 9000, value: 3, unit: 's' },
  { begin: 9000, end: 14000, unit: 's' },
  { begin: 14000, end: 15000, value: -3, unit: 's' },
  { begin: 15000, end: 16000, value: -6, unit: 's' },
  { begin: 16000, end: 17000, value: -3, unit: 'm' },
  { begin: 17000, end: 25000, unit: 's' },
];

const dataCategories = [
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
  intervalType: INTERVAL_TYPES.NUMBER | INTERVAL_TYPES.NUMBER_WITH_UNIT | INTERVAL_TYPES.SELECT;
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

  switch (intervalType) {
    case INTERVAL_TYPES.NUMBER_WITH_UNIT:
      return (
        <IntervalsEditor
          {...props}
          data={data as LinearMetadataItem<{ value: number | string; unit: string }>[]}
          defaultUnit={units[0]}
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
    case INTERVAL_TYPES.SELECT:
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
    case INTERVAL_TYPES.NUMBER:
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
        />
      );
    default:
      return <div />;
  }
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
    defaultValue: 0,
    exampleData: dataNumber,
    fieldLabel: 'gradient',
    intervalType: INTERVAL_TYPES.NUMBER,
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

export const ByValueWithUnit = {
  args: {
    defaultValue: 0,
    exampleData: dataNumberWithUnit,
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
    defaultValue: '',
    exampleData: dataCategories,
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
