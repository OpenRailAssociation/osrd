import React from 'react';
import { JSONSchema7 } from 'json-schema';

import { LinearMetadataItem } from './data';

interface LinearMetadataTooltipProps<T> {
  item: LinearMetadataItem<T>;
  schema: JSONSchema7;
}

export const LinearMetadataTooltip = <T extends any>({
  item,
  schema,
}: LinearMetadataTooltipProps<T>) => {
  const properties = Object.keys(schema.properties || {}).filter(
    (i) => !['begin', 'end'].includes(i)
  );

  return (
    <div className="linear-metadata-tooltip">
      <div className="header">
        <span>{Math.round(item.begin)}</span>
        <span className="mx-3" />
        <span>{Math.round(item.end)}</span>
      </div>
      <div className="content">
        {properties.map((k) => (
          <div key={k}>
            <span className="mr-3">
              {((schema.properties || {})[k] as JSONSchema7 | undefined)?.title || k}
            </span>
            {item[k] || '-'}
          </div>
        ))}
      </div>
    </div>
  );
};
