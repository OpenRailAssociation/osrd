import React from 'react';
import { useTranslation } from 'react-i18next';
import { GoSearch } from 'react-icons/go';
import Tipped from 'common/Tipped';

type ButtonMapSearchProps = {
  toggleMapSearch: () => void;
};

const ButtonMapSearch = ({ toggleMapSearch }: ButtonMapSearchProps) => {
  const { t } = useTranslation('translation');
  return (
    <Tipped mode="left">
      <button
        type="button"
        className="btn-rounded btn-rounded-white btn-map-search"
        onClick={toggleMapSearch}
      >
        <span className="sr-only">Search</span>
        <GoSearch />
      </button>
      <span>{t('common.search')}</span>
    </Tipped>
  );
};

export default ButtonMapSearch;
