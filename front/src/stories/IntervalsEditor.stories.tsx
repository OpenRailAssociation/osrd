import { FieldProps } from '@rjsf/core';
import { LinearMetadataItem } from 'applications/editor/components/LinearMetadata';
import IntervalsEditor from 'common/IntervalsEditor/IntervalsEditor';
import { JSONSchema7 } from 'json-schema';
import React, { useState } from 'react';

const SAMPLE_DATA = ['First Category of Speed Limits', 'Second Category of Speed Limits'];

let formDataBase = [
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

const schemaSample: JSONSchema7 = {
  title: 'Linear Data',
  description: 'List of slopes of corresponding track section',
  type: 'array',
  items: { $ref: '#/definitions/Slope' },
};

const IntervalsEditorWrapper: React.FC<FieldProps> = (props) => {
  const { formContext, schema, params, valueField } = props;
  const [mockedData, setMockedData] = useState<LinearMetadataItem[] | null>(formDataBase);
  const onChange = (newData: LinearMetadataItem[]) => {
    console.log('onchange call', newData);
    setMockedData(newData);
  };
  return (
    <IntervalsEditor
      {...props}
      formContext={formContext}
      schema={schema}
      formData={mockedData}
      params={params}
      valueField={valueField}
      onChange={onChange}
      defaultValue={0}
    />
  );
};

const IntervalsDemonstrator = {
  title: 'IntervalsDemonstrator',
  component: IntervalsEditorWrapper,
};

export default IntervalsDemonstrator;

export const Plain = {
  args: {
    formContext: formContextSample,
    schema: schemaSample,
    valueField: 'gradient',
    params: { deleteTool: true, translateTool: true, cutTool: true, addTool: true },
  },
};
