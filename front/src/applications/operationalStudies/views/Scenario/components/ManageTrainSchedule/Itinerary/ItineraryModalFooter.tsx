import { useState } from 'react';

import { Button } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type { EditingTrainType } from 'reducers/osrdconf/types';

export type ItineraryModalFooterProps = {
  mode: 'new' | 'edit';
  trainType: EditingTrainType;
  onCancel: () => void;
  onSubmit: (trainType?: EditingTrainType) => void;
  isWorking: boolean;
};

export default function ItineraryModalFooter({
  mode,
  trainType,
  onCancel,
  onSubmit,
  isWorking,
}: ItineraryModalFooterProps) {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'manageTrainSchedule.itineraryModal',
  });
  const { scenario } = useScenarioContext();
  const [submittingType, setSubmittingType] = useState<EditingTrainType>();

  const handleSubmit = (type: EditingTrainType) => {
    setSubmittingType(type);
    onSubmit(type);
  };

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
          {scenario.timetable_type !== 'HOURLY' && (
            <Button
              label={t('submit.addSingleTrain')}
              variant="Normal"
              size="medium"
              onClick={() => handleSubmit('uniqueTrain')}
              dataTestID="itinerary-modal-add-single-train-button"
              isLoading={submittingType === 'uniqueTrain' && isWorking}
            />
          )}
          <Button
            label={t('submit.addService')}
            variant="Primary"
            size="medium"
            onClick={() => handleSubmit('pacedTrain')}
            dataTestID="itinerary-modal-add-service-train-button"
            isLoading={submittingType === 'pacedTrain' && isWorking}
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
          isLoading={isWorking}
        />
      )}
    </div>
  );
}
