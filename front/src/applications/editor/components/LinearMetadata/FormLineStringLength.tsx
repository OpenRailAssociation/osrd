import { useEffect, useState, useMemo } from 'react';

import type { WidgetProps } from '@rjsf/utils';
import cx from 'classnames';
import { toNumber } from 'lodash';
import { useTranslation } from 'react-i18next';

export const FormLineStringLength = ({ id, value, required, onChange }: WidgetProps) => {
  const { t } = useTranslation();

  const [length, setLength] = useState<number>(toNumber(value));

  useEffect(() => {
    setLength(value);
  }, [value]);

  const hasChanged = useMemo(() => toNumber(value) !== length, [value, length]);

  return (
    <div>
      <input
        className="form-control"
        id={id}
        required={required}
        type="number"
        value={length}
        onKeyDown={(e) => {
          if (hasChanged) {
            if (e.key === 'Enter') {
              e.preventDefault();
              onChange(length);
            } else if (e.key === 'Escape') {
              setLength(value);
            }
          }
        }}
        onChange={(e) => {
          setLength(e.target.valueAsNumber);
        }}
      />
      <div className="my-1 d-flex justify-content-end">
        <button
          type="button"
          disabled={!hasChanged}
          className={cx('btn btn-sm btn-secondary', { disabled: !hasChanged })}
          onClick={() => setLength(toNumber(value))}
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          disabled={!hasChanged}
          className={cx('ml-1 btn btn-sm btn-primary', { disabled: !hasChanged })}
          onClick={() => onChange(length)}
        >
          {t('common.confirm')}
        </button>
      </div>
    </div>
  );
};
export default FormLineStringLength;
