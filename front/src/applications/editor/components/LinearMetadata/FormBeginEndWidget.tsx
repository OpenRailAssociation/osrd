import React, { useState, useRef } from 'react';
import { WidgetProps } from '@rjsf/core';

export const FormBeginEndWidget: React.FC<WidgetProps> = (props) => {
  const { id, label, value, required, readonly, onChange, options, rawErrors, schema } = props;
  return (
    <div>
      {readonly ? (
        <span className="form-control readonly bg-light">{value}</span>
      ) : (
        <input
          className="form-control"
          id={id}
          required={required}
          type="number"
          step="1"
          min={schema.minimum || (options.min as number)}
          max={schema.maximum || (options.max as number)}
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
