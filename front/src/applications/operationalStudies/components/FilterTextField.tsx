import { useState, useEffect } from 'react';

import { Search } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useDebounce } from 'utils/helpers';

type Props = {
  id: string;
  setFilter: (filter: string) => void;
  sm?: boolean;
  filterChips?: string;
};

export default function FilterTextField({ id, setFilter, sm = false, filterChips = '' }: Props) {
  const [value, setValue] = useState('');
  const { t } = useTranslation('operational-studies');
  const debouncedFilter = useDebounce(value, 500);

  useEffect(() => {
    if (filterChips !== '') {
      setValue(filterChips);
    }
  }, [filterChips]);

  useEffect(() => {
    setFilter(debouncedFilter);
  }, [debouncedFilter]);

  return (
    <InputSNCF
      type="text"
      id={id}
      name={id}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder={t('operational-studies-management.filter-placeholder')}
      whiteBG
      noMargin
      unit={<Search />}
      sm={sm}
    />
  );
}
