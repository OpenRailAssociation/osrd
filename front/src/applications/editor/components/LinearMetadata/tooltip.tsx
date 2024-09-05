import type { JSONSchema7 } from 'json-schema';
import { isNil } from 'lodash';

import type { LinearMetadataItem } from 'common/IntervalsDataViz/types';

interface LinearMetadataTooltipProps<T> {
  item: LinearMetadataItem<T>;
  point?: number;
  schema: JSONSchema7;
}

export const LinearMetadataTooltip = <T extends Record<string, unknown>>({
  item,
  point,
  schema,
}: LinearMetadataTooltipProps<T>) => {
  const properties = Object.keys(schema.properties || {}).filter(
    (i) => !['begin', 'end'].includes(i)
  );

  return (
    <div className="linear-metadata-tooltip">
      <div className="header">
        <span>{Math.round(item.begin)}</span>
        {point &&
          Math.round(point) !== Math.round(item.begin) &&
          Math.round(point) !== Math.round(item.end) && (
            <>
              <span>-</span>
              <span>{Math.round(point)}</span>
            </>
          )}
        <span>-</span>
        <span>{Math.round(item.end)}</span>
      </div>
      <div className="content">
        {properties.map((k) => (
          <div key={k}>
            <span className="mr-3">
              {((schema.properties || {})[k] as JSONSchema7 | undefined)?.title || k}
            </span>
            {isNil(item[k]) ? '-' : `${item[k]}`}
          </div>
        ))}
      </div>
    </div>
  );
};

export default LinearMetadataTooltip;
