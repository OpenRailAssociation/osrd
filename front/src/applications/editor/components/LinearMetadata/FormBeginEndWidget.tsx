import React from 'react';

import type { WidgetProps } from '@rjsf/utils';

export const FormBeginEndWidget = (props: WidgetProps) => {
  const { id, value, required, readonly, onChange, options, schema } = props;
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
          min={schema.minimum || (options.min as number)}
          max={schema.maximum || (options.max as number)}
          step="any"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
};

export default FormBeginEndWidget;
