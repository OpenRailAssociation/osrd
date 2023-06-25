import React from 'react';
import { LinearMetadataItem } from 'applications/editor/components/LinearMetadata';
import { useTranslation } from 'react-i18next';

interface IntervalsEditorTooltip<T> {
  item: LinearMetadataItem<T>;
  point?: number;
}

export const IntervalsEditorTooltip = <T extends Record<string, unknown>>({
  item,
  point,
}: IntervalsEditorTooltip<T>) => {
  const { t } = useTranslation();
  return (
    <div className="linear-metadata-tooltip">
      <div className="header">{point && <span>{Math.round(point)}</span>}</div>
      <div className="content">
        {Object.entries(item).map((value, index) => (
          <div key={index}>
            <span className="mr-3">{t(value[0])}</span>
            {`${value[1] || '-'}`}
          </div>
        ))}
      </div>
    </div>
  );
};

export default IntervalsEditorTooltip;
