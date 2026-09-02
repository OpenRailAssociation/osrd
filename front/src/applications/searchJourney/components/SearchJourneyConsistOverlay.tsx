import { Lock } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

/**
 * Placeholder shown on top of the (visually present but non-functional) consist
 * card: consist configuration is out of scope for search journey for now.
 */
const SearchJourneyConsistOverlay = () => {
  const { t } = useTranslation('search-journey');

  return (
    <div className="search-journey-consist-overlay">
      <Lock size="lg" />
      <span>{t('consist.unavailable')}</span>
    </div>
  );
};

export default SearchJourneyConsistOverlay;
