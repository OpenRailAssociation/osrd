import React, { useState, useRef } from 'react';
import { WidgetProps } from '@rjsf/core';

export const FormBeginEndWidget: React.FC<WidgetProps> = (props) => {
  console.log(props);
  const { id, label, value, required, readonly, onChange, options } = props;
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
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
};
