import React, { useEffect, useState } from 'react';
import { WidgetProps } from '@rjsf/core';
import { useTranslation } from 'react-i18next';

import { getLineStringDistance, DISTANCE_ERROR_RANGE } from './data';

export const FormLineStringLength: React.FC<WidgetProps> = (props) => {
  const { t } = useTranslation();
  const { id, value, required, readonly, onChange, formContext } = props;

  const [length, setLength] = useState<number>(value || 0);
  const [min, setMin] = useState<number>(-Infinity);
  const [max, setMax] = useState<number>(Infinity);
  const [geoLength, setGeoLength] = useState<number>(0);

  useEffect(() => {
    setLength(value || 0);
  }, [value]);

  /**
   * When the geometry changes
   * => recompute min & max plus its length
   */
  useEffect(() => {
    const distance = getLineStringDistance(formContext.geometry);
    if (formContext.isCreation) {
      setTimeout(() => onChange(distance), 0);
    } else {
      setMin(Math.round(distance - distance * DISTANCE_ERROR_RANGE));
      setMax(Math.round(distance + distance * DISTANCE_ERROR_RANGE));
      setGeoLength(distance);
    }
  }, [formContext.geometry, formContext.isCreation, onChange]);

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
          value={length}
          onChange={(e) => {
            const nValue = parseFloat(e.target.value);
            onChange(nValue);
          }}
        />
      )}
      {geoLength && (length === undefined || length < min || length > max) && (
        <p className="text-warning">
          {t('Editor.errors.length-out-of-sync-with-geometry', { min, max })}.{' '}
          <button
            type="button"
            className="btn btn-link btn-secondary"
            title={t('Editor.linear-metadata.sync-length-with-geometry')}
            onClick={() => onChange(geoLength)}
          >
            {t('Editor.linear-metadata.sync-length-with-geometry')}
          </button>
        </p>
      )}
    </div>
  );
};
export default FormLineStringLength;
