import React from 'react';
import { WidgetProps } from '@rjsf/core';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';

export const CustomPosition: React.FC<WidgetProps> = (props) => {
  const { schema, onChange, title, value } = props;
  const POINT_NAME = 'point-parameter';

  return (
    <div key={`${POINT_NAME}-${schema.description}`}>
      <p>{title}</p>
      <InputSNCF
        name={POINT_NAME}
        id={`${POINT_NAME}-${schema.description}`}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        type="number"
        min={0}
      />
    </div>
  );
};

export default CustomPosition;
