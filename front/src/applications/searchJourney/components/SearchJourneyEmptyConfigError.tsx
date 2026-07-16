import { Search } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

const SearchJourneyEmptyConfigError = () => {
  const { t } = useTranslation('search-journey');
  return (
    <div className="search-journey-config-error">
      <span className="icon">
        <Search size="lg" />
      </span>
      <h2 className="mx-0">{t('noConfigurationFound.title')}</h2>
      <p>{t('noConfigurationFound.text')}</p>
    </div>
  );
};

export default SearchJourneyEmptyConfigError;
