import { Button } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

import type { OperationalStudiesConfState } from 'reducers/osrdconf/types';

// TODO: Define a proper type here as soon as we get rid of the old modal store
export type FooterTrainType = OperationalStudiesConfState['editingTrainType'];

export type ItineraryModalFooterProps = {
  mode: 'new' | 'edit';
  trainType: FooterTrainType;
  onCancel: () => void;
  onSubmit: (trainType?: FooterTrainType) => void;
};

export default function ItineraryModalFooter({
  mode,
  trainType,
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
      {mode === 'new' ? (
        <div className="itinerary-modal-submit-buttons">
          <Button
            label={t('submit.addSingleTrain')}
            variant="Normal"
            size="medium"
            onClick={() => onSubmit('uniqueTrain')}
            dataTestID="itinerary-modal-add-single-train-button"
          />
          <Button
            label={t('submit.addService')}
            variant="Primary"
            size="medium"
            onClick={() => onSubmit('pacedTrain')}
            dataTestID="itinerary-modal-add-service-train-button"
          />
        </div>
      ) : (
        <Button
          label={
            trainType === 'uniqueTrain'
              ? t('submit.editSingleTrain')
              : trainType === 'pacedTrain'
                ? t('submit.editService')
                : t('submit.editOccurrence')
          }
          variant="Primary"
          size="medium"
          onClick={onSubmit}
          dataTestID="itinerary-modal-edit-train-button"
        />
      )}
    </div>
  );
}
