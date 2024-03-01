import React, { useEffect, useState } from 'react';

import type { WidgetProps } from '@rjsf/utils';
import { isNil, toNumber, isEmpty } from 'lodash';
import { useTranslation } from 'react-i18next';

import { getLineStringDistance, DISTANCE_ERROR_RANGE } from 'common/IntervalsDataViz/data';

export const FormLineStringLength: React.FC<WidgetProps> = (props) => {
  const { t } = useTranslation();
  const { id, value, required, readonly, onChange, formContext } = props;

  const [length, setLength] = useState<number>(value);
  const [min, setMin] = useState<number>(-Infinity);
  const [max, setMax] = useState<number>(Infinity);
  const [geoLength, setGeoLength] = useState<number>(0);

  useEffect(() => {
    setLength(value);
  }, [value]);

  /**
   * When the geometry changes
   * => recompute min & max plus its length
   */
  useEffect(() => {
    const distance = getLineStringDistance(formContext.geometry);
    setMin(Math.round(distance - distance * DISTANCE_ERROR_RANGE));
    setMax(Math.round(distance + distance * DISTANCE_ERROR_RANGE));
    setGeoLength(distance);
  }, [formContext.geometry, formContext.isCreation]);

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
          value={!isNil(length) ? length : ''}
          onChange={(e) => {
            setLength(e.target.valueAsNumber);
            onChange(!isEmpty(e.target.value) ? toNumber(e.target.value) : null);
          }}
        />
      )}
      {geoLength > 0 && (length < min || length > max) && (
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
      {isNil(length) && (
        <p className="text-danger">
          {t('Editor.errors.length-number-and-required')}
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
