import React from 'react';

import type { WidgetProps } from '@rjsf/utils';

const CustomFlagSignalCheckbox = ({ schema, onChange, title, value }: WidgetProps) => {
  const FLAG_NAME = 'flag-signal-parameter';

  return (
    <div className="d-flex align-items-center" key={`${FLAG_NAME}-${schema.description}`}>
      <p>{title}</p>
      <input
        style={{ cursor: 'pointer' }}
        type="checkbox"
        name={FLAG_NAME}
        id={`${FLAG_NAME}-${schema.description}`}
        checked={value === 'true'}
        onChange={(e) => onChange(e.target.checked.toString())}
      />
      <label className="mt-1 ml-1 mb-0" htmlFor={`${FLAG_NAME}-${schema.description}`}>
        {schema.description}
      </label>
    </div>
  );
};

export default CustomFlagSignalCheckbox;
