/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useDebounce } from 'utils/helpers';

type Props = {
  id: string;
  setFilter: (arg0: string) => void;
  sm?: boolean;
};

export default function FilterTextField({ id, setFilter, sm = false }: Props) {
  const [value, setValue] = useState('');
  const { t } = useTranslation('operationalStudies/home');
  const debouncedFilter = useDebounce(value, 500);

  useEffect(() => {
    setFilter(debouncedFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedFilter]);

  return (
    <InputSNCF
      type="text"
      id={id}
      name={id}
      value={value}
      onChange={(e: any) => setValue(e.target.value)}
      placeholder={t('filterPlaceholder')}
      whiteBG
      noMargin
      unit={<i className="icons-search" />}
      sm={sm}
    />
  );
}
