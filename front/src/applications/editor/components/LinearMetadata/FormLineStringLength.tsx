import React, { useEffect, useState } from 'react';
import { WidgetProps } from '@rjsf/core';
import { useTranslation } from 'react-i18next';

import { getLineStringDistance, DISTANCE_ERROR_RANGE } from './data';

export const FormLineStringLength: React.FC<WidgetProps> = (props) => {
  const { t } = useTranslation();
  const { id, value, required, readonly, onChange, formContext } = props;

  const [length, setLength] = useState<number>(value);
  const [min, setMin] = useState<number>(-Infinity);
  const [max, setMax] = useState<number>(Infinity);
  const [geoLength, setGeoLength] = useState<number>(0);

  /**
   * When the geometry changes
   * => recompute min & max plus its length
   */
  useEffect(() => {
    const distance = getLineStringDistance(formContext.geometry);
    setMin(Math.round(distance - distance * DISTANCE_ERROR_RANGE));
    setMax(Math.round(distance + distance * DISTANCE_ERROR_RANGE));
    setGeoLength(distance);
  }, [formContext.geometry]);

  /**
   * When the input value change
   * => if it is valid, we call the onChange
   */
  useEffect(() => {
    if (value !== undefined) setLength(value);
    else setLength(geoLength);
  }, [value, geoLength]);

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
          min={min}
          max={max}
          step="any"
          value={length}
          onChange={(e) => {
            const nValue = parseFloat(e.target.value);
            if (nValue >= min && nValue <= max) onChange(nValue);
            else setLength(nValue);
          }}
        />
      )}
      {(length === undefined || length < min || length > max) && (
        <p className="text-danger">
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
