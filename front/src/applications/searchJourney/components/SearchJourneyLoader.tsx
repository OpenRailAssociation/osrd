import { Button } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

type SearchJourneyLoaderProps = {
  cancelSearchJourneyRequest: () => void;
};

const SearchJourneyLoader = ({ cancelSearchJourneyRequest }: SearchJourneyLoaderProps) => {
  const { t } = useTranslation('search-journey');

  return (
    <div className="search-journey-loader">
      <h2>{t('search.pending')}</h2>
      <Button
        dataTestID="search-journey-cancel-request-button"
        variant="Cancel"
        label={t('search.cancel')}
        size="small"
        onClick={cancelSearchJourneyRequest}
      />
    </div>
  );
};

export default SearchJourneyLoader;
