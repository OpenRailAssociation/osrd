import React, { useState } from 'react';
import 'stories/storybook.css';

import { fixLinearMetadataItems } from 'common/IntervalsDataViz/data';
import type { LinearMetadataItem, OperationalPoint } from 'common/IntervalsDataViz/types';
import { notEmpty } from 'common/IntervalsDataViz/utils';
import IntervalsEditor from 'common/IntervalsEditor/IntervalsEditor';
import {
  type AdditionalDataItem,
  INTERVAL_TYPES,
  type IntervalItem,
  type IntervalsEditorToolsConfig,
} from 'common/IntervalsEditor/types';

const operationalPoints: OperationalPoint[] = [
  { id: 'a', position: 1000, name: 'a' },
  { id: 'b', position: 10000, name: 'b' },
  { id: 'c', position: 22000, name: 'c' },
  { id: 'd', position: 25000, name: 'd' },
];

type IntervalsEditorProps = {
  additionalData?: AdditionalDataItem[];
  defaultValue: number | string;
  defaultUnit?: string;
  emptyValue: unknown;
  data: IntervalItem[];
  fieldLabel: string;
  intervalType: INTERVAL_TYPES.NUMBER | INTERVAL_TYPES.NUMBER_WITH_UNIT | INTERVAL_TYPES.SELECT;
  selectOptions?: string[];
  title?: string;
  toolsConfig?: IntervalsEditorToolsConfig;
  totalLength: number;
  units: string[];
};

const IntervalsEditorWrapper = (props: IntervalsEditorProps) => {
  const { data, intervalType, selectOptions, totalLength, units = [] } = props;
  const [persistedData, setData] = useState<IntervalItem[]>(
    fixLinearMetadataItems(data.filter(notEmpty), totalLength)
  );

  switch (intervalType) {
    case INTERVAL_TYPES.NUMBER_WITH_UNIT:
      return (
        <IntervalsEditor
          {...props}
          data={persistedData as LinearMetadataItem<{ value: number | string; unit: string }>[]}
          defaultUnit={units[0]}
          intervalType={intervalType}
          operationalPoints={operationalPoints}
          setData={setData}
          showValues
          units={units}
        />
      );
    case INTERVAL_TYPES.SELECT:
      return (
        <IntervalsEditor
          {...props}
          data={persistedData as LinearMetadataItem<{ value: number | string }>[]}
          intervalType={intervalType}
          operationalPoints={operationalPoints}
          setData={setData}
          showValues
          selectOptions={selectOptions || []}
        />
      );
    case INTERVAL_TYPES.NUMBER:
      return (
        <IntervalsEditor
          {...props}
          data={persistedData as LinearMetadataItem<{ value: number | string }>[]}
          intervalType={intervalType}
          operationalPoints={operationalPoints}
          setData={setData}
          showValues
        />
      );
    default:
      return <div />;
  }
};

/**
 * This component allows a user to edit ranges on a path and to attribute a value to each range.
 * The value can either be a number, a number with a unit or a string selected among options.
 *
 * The component displays the path and the intervals, but it can also display some special points (named operationalPoints)
 * and additional range data, below the intervals editor.
 *
 * Here are some features implemented by the component:
 * - the user can create a new range, split an existing range, merge a range into its right neighbor or delete a range
 * - the user can resize a range thanks to its side bar (on its right)
 * - the user can also click on a range to edit its extremities and its value
 * - the user can zoom in and out thanks to the zoom buttons or by scrolling on the component
 * - the user can drag & drop the component to slide to the left or the right
 * - when resizing, the user can snap to the closest operationalPoint
 */
export default {
  title: 'Common/IntervalsDemonstrator',
  component: IntervalsEditorWrapper,
  argTypes: {
    additionalDataItem: {
      description: 'Additional read-only range data that will be displayed below the chart.',
    },
    defaultValue: {
      description: 'Default value that will be given to any new range.',
    },
    defaultUnit: {
      description:
        'Default unit that will be given to any new range if interval type is NUMBER_WITH_UNIT.',
    },
    emptyValue: {
      description:
        'If a range has its value === emptyValue, then it will be displayed as empty (crossed red lines).',
    },
    fieldLabel: {
      description:
        'Name of the value of the ranges. It is displayed in the form when a range is selected.',
    },
    data: {
      description:
        'Array of ranges. Each range should have a begin (number), an end (number) and a value whose type depends on intervalType.' +
        'These array of ranges always cover the whole path.',
    },
    intervalType: {
      description:
        'IntervalType gives the information on what type is the value of each range.' +
        'It can be a number (NUMBER), a number with a unit (NUMBER_WITH_UNIT) or a string selected from a set of options (SELECT).',
    },
    operationalPoints: {
      description: 'Array of remarkable points on path. The user can snap on them when resizing.',
    },
    selectOptions: {
      description: 'Select options for the value. It is required if intervalType is SELECT.',
    },
    title: { description: 'Title of the container of the intervals editor.' },
    toolsConfig: {
      description: 'Configuration of the tools: indicates which tool should be available or not.',
    },
    totalLength: { description: 'Total length of the path.' },
    units: { description: 'Array of units. It is required if intervalType is NUMBER_WITH_UNIT.' },
  },
};

export const Number = {
  args: {
    defaultValue: 1,
    data: [
      { begin: 0, end: 1000, value: 1 },
      { begin: 1000, end: 6000 },
      { begin: 6000, end: 7000, value: 3 },
      { begin: 7000, end: 8000, value: 6 },
      { begin: 8000, end: 9000, value: 3 },
      { begin: 9000, end: 14000, value: 0 },
      { begin: 14000, end: 15000, value: -3 },
      { begin: 15000, end: 16000, value: -6 },
      { begin: 16000, end: 17000, value: -3 },
      { begin: 17000, end: 25000, value: 0 },
    ],
    emptyValue: 0,
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

export const NumberWithUnit = {
  args: {
    defaultValue: 1,
    data: [
      { begin: 0, end: 6000, value: 0, unit: 's' },
      { begin: 6000, end: 7000, value: 3, unit: 's' },
      { begin: 7000, end: 8000, value: 6, unit: 's' },
      { begin: 8000, end: 9000, value: 3, unit: 's' },
      { begin: 9000, end: 14000, value: 0, unit: 's' },
      { begin: 14000, end: 15000, value: -3, unit: 's' },
      { begin: 15000, end: 16000, value: -6, unit: 's' },
      { begin: 16000, end: 17000, value: -3, unit: 'm' },
      { begin: 17000, end: 25000, value: 0, unit: 's' },
    ],
    emptyValue: 0,
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

export const Select = {
  args: {
    additionalData: [
      { begin: 0, end: 10000, value: '25000V' },
      { begin: 10000, end: 20000, value: '' },
      { begin: 20000, end: 22000, value: '1500V' },
      { begin: 22000, end: 25000, value: '25000V' },
    ],
    defaultValue: '',
    emptyValue: '',
    data: [
      { begin: 0, end: 6000, value: '' },
      { begin: 6000, end: 7000, value: 'U3' },
      { begin: 7000, end: 8000, value: 'U5' },
      { begin: 8000, end: 9000, value: 'U4' },
      { begin: 9000, end: 14000, value: '' },
      { begin: 14000, end: 15000, value: 'U1' },
      { begin: 15000, end: 16000, value: 'U3' },
      { begin: 16000, end: 17000, value: 'U3' },
      { begin: 17000, end: 25000, value: '' },
    ],
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
