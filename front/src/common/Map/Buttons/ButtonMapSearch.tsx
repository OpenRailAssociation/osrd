import { Search } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

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
        <Search size="lg" />
      </button>
      <span>{t('common.search')}</span>
    </Tipped>
  );
};

export default ButtonMapSearch;
