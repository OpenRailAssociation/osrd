import React, { useState, useRef } from 'react';
import { WidgetProps } from '@rjsf/core';

export const FormBeginEndWidget: React.FC<WidgetProps> = (props) => {
  console.log(props);
  const { id, label, value, required, readonly, onChange, options, rawErrors } = props;
  return (
    <div>
      {readonly ? (
        <span className="form-control bg-light">{value}</span>
      ) : (
        <input
          className="form-control"
          id={id}
          required={required}
          type="number"
          step="1"
          min={options.min as number}
          max={options.max as number}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {rawErrors?.map((e) => (
        <p className="text-danger">{e}</p>
      ))}
    </div>
  );
};
