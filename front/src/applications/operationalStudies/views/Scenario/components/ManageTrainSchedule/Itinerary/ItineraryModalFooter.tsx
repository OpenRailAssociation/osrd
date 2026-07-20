import { Button } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

export type ItineraryModalFooterProps = {
  mode: 'new' | 'edit';
  onCancel: () => void;
  onSubmit: () => void;
};

export default function ItineraryModalFooter({
  mode,
  onCancel,
  onSubmit,
}: ItineraryModalFooterProps) {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'manageTrainSchedule.itineraryModal',
  });

  return (
    <div className="itinerary-modal-form-footer" data-testid="itinerary-modal-form-footer">
      <Button
        label={t('cancel')}
        variant="Cancel"
        size="medium"
        onClick={onCancel}
        dataTestID="close-itinerary-modal"
      />
      <Button
        label={mode === 'edit' ? t('edit') : t('next')}
        variant="Primary"
        size="medium"
        onClick={onSubmit}
        dataTestID="itinerary-modal-next-button"
      />
    </div>
  );
}
