import { FieldProps } from '@rjsf/core';
import { LinearMetadataItem } from 'common/IntervalsDataViz/data';
import { IntervalsEditor } from 'common/IntervalsEditor/IntervalsEditor';
import React, { useState } from 'react';
import 'stories/storybook.css';

const formDataBase = [
  { begin: 0, end: 6000 },
  { begin: 6000, end: 7000, gradient: 3 },
  { begin: 7000, end: 8000, gradient: 6 },
  { begin: 8000, end: 9000, gradient: 3 },
  { begin: 9000, end: 14000 },
  { begin: 14000, end: 15000, gradient: -3 },
  { begin: 15000, end: 16000, gradient: -6 },
  { begin: 16000, end: 17000, gradient: -3 },
  { begin: 17000, end: 25000 },
];

const formDataBaseCategories = [
  { begin: 0, end: 6000 },
  { begin: 6000, end: 7000, power: 'U3' },
  { begin: 7000, end: 8000, power: 'U5' },
  { begin: 8000, end: 9000, power: 'U4' },
  { begin: 9000, end: 14000 },
  { begin: 14000, end: 15000, power: 'U1' },
  { begin: 15000, end: 16000, power: 'U3' },
  { begin: 16000, end: 17000, power: 'U3' },
  { begin: 17000, end: 25000 },
];

const formContextSample = {
  geometry: {
    coordinates: [
      [-0.296, 49.5],
      [-0.172, 49.5],
    ],
    type: 'LineString',
  },
  length: 25000,
  isCreation: false,
};

const IntervalsEditorWrapper: React.FC<FieldProps> = (props) => {
  const { formContext, params, valueField, defaultValue, dataBase, values } = props;
  const [mockedData, setMockedData] = useState<LinearMetadataItem[] | null>(dataBase);
  const onChange = (newData: LinearMetadataItem[]) => {
    setMockedData(newData);
  };
  return (
    <IntervalsEditor
      {...props}
      formContext={formContext}
      formData={mockedData}
      params={params}
      valueField={valueField}
      onChange={onChange}
      defaultValue={defaultValue as number}
      values={values}
    />
  );
};

export default {
  title: 'IntervalsDemonstrator',
  component: IntervalsEditorWrapper,
  argTypes: {
    onChange: { description: 'Value sent back to wrapper', action: 'onChange' },
  },
};

export const ByContinousValues = {
  args: {
    formContext: formContextSample,
    valueField: 'gradient',
    params: {
      deleteTool: true,
      translateTool: false,
      cutTool: true,
      addTool: true,
      showValues: true,
    },
    units: ['s', 'm'],
    name: 'linearMetaData',
    defaultValue: null,
    dataBase: formDataBase,
  },
};

export const ByCategories = {
  args: {
    formContext: formContextSample,
    valueField: 'power',
    params: {
      deleteTool: true,
      translateTool: false,
      cutTool: true,
      addTool: true,
      showValues: true,
    },
    units: null,
    name: 'linearMetaData',
    defaultValue: null,
    dataBase: formDataBaseCategories,
    values: ['U1', 'U2', 'U3', 'U4', 'U5'],
  },
};
