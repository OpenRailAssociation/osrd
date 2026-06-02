import { Button, Checkbox, Input } from '@osrd-project/ui-core';
import { ChevronUp } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import type { PacedTrainWithPaced } from 'applications/operationalStudies/types';
import type { Train } from 'reducers/osrdconf/types';
import { useDateTimeLocale } from 'utils/date';
import { findExceptionInPacedTrainByOccurenceId } from 'utils/trainExceptions';
import { isOccurrenceId } from 'utils/trainId';

import {
  getCategoryName,
  getComfortType,
  getServiceInterval,
  getServiceWindow,
  getShortDepartureDate,
} from './utils/trainProperties';

export type ExpandedTrainFormProps = {
  train: Train;
  onCollapse: () => void;
};

/**
 * A header-shaped form that allow users to set most of the properties of a train, beside the itinerary itself.
 */
const ExpandedTrainForm = ({ train, onCollapse }: ExpandedTrainFormProps) => {
  const { t } = useTranslation(['operational-studies', 'translation']);
  const dateTimeLocale = useDateTimeLocale();

  const pacedTrain = train.paced ? (train as PacedTrainWithPaced) : null;
  const occurenceId = isOccurrenceId(train.id) ? train.id : null;
  const exception =
    occurenceId && pacedTrain
      ? findExceptionInPacedTrainByOccurenceId(occurenceId, pacedTrain)
      : null;

  const toggleBand = (
    <div className="toggle-band">
      <button className="header-toggle" onClick={() => onCollapse()}>
        <ChevronUp />
      </button>
    </div>
  );

  return (
    <div className="train-header expanded-train-form">
      {pacedTrain && (
        <div className="train-service">
          {toggleBand}
          {occurenceId ? (
            <div className="train-occurrence">
              <div className="train-paced-kind">
                {t('manageTrainSchedule.trainHeader.serviceOccurrence')}
                {exception && ' ≠'}
              </div>
            </div>
          ) : (
            <div className="train-service-form">
              <div className="train-paced-kind">
                {t('manageTrainSchedule.trainHeader.serviceModelTrain')}
              </div>
              <div className="train-service-cadence">
                <Input
                  id="train-header-service-cadence-input"
                  small
                  label={t('manageTrainSchedule.trainHeader.form.serviceCadence')}
                  value={`${getServiceInterval(pacedTrain) ?? 0} min`}
                  disabled
                />
              </div>
              <div className="train-service-window">
                <Input
                  id="train-header-service-window-input"
                  small
                  label={t('manageTrainSchedule.trainHeader.form.serviceWindow')}
                  value={`${getServiceWindow(pacedTrain) ?? 0} min`}
                  disabled
                />
              </div>
              <div className="actions">
                <Button
                  label={t('manageTrainSchedule.trainHeader.form.extraOccurrences', {
                    count: 0 /* TODO: properly compute the number of extra occurrences */,
                  })}
                  variant="Quiet"
                  onClick={() => {}}
                  size="small"
                  isDisabled
                />
              </div>
            </div>
          )}
        </div>
      )}
      {!pacedTrain && toggleBand}
      <div className="train-form">
        <div className="train-name">
          <Input
            id="train-header-name-input"
            small
            label={t('manageTrainSchedule.trainHeader.form.trainName')}
            value={train.train_name ?? ''}
            disabled
          />
        </div>
        <div className="train-departure-date">
          <Input
            id="train-header-departure-date-input"
            small
            label={t('manageTrainSchedule.trainHeader.form.departureDate')}
            value={getShortDepartureDate(train, dateTimeLocale) ?? ''}
            disabled
          />
        </div>
        <div className="train-initial-velocity">
          <Input
            id="train-header-initial-velocity-input"
            small
            label={t('manageTrainSchedule.trainHeader.form.initialVelocity')}
            value={train.initial_speed ?? ''}
            disabled
          />
        </div>
        <div className="train-category">
          <Input
            id="train-header-category-input"
            small
            label={t('manageTrainSchedule.trainHeader.form.trainCategory')}
            value={getCategoryName(train, t) ?? ''}
            disabled
          />
        </div>
        <div className="train-rolling-stock">
          <Input
            id="train-header-rolling-stock-input"
            small
            label={t('manageTrainSchedule.trainHeader.form.rollingStock')}
            value={train.rolling_stock_name ?? ''}
            disabled
          />
        </div>
        <div className="train-composition-code">
          <Input
            id="train-header-composition-code-input"
            small
            label={t('manageTrainSchedule.trainHeader.form.compositionCode')}
            value={train.speed_limit_tag ?? ''}
            disabled
          />
        </div>
        <div className="train-recovery-margin">
          <Input
            id="train-header-recovery-margin-input"
            small
            label={t('manageTrainSchedule.trainHeader.form.recoveryMargin')}
            value={
              train.constraint_distribution === 'MARECO'
                ? t('manageTrainSchedule.allowances.distribution-mareco')
                : t('manageTrainSchedule.allowances.distribution-linear')
            }
            disabled
          />
        </div>
        <div className="train-comfort">
          <Input
            id="train-header-comfort-input"
            small
            label={t('manageTrainSchedule.trainHeader.form.comfort')}
            value={getComfortType(train, t) ?? ''}
            disabled
          />
        </div>
        <div className="train-electric-profile loose-field">
          <Checkbox
            id="train-header-electric-profile-input"
            checked={train?.options?.use_electrical_profiles}
            disabled
          >
            {t('manageTrainSchedule.trainHeader.form.electricalProfiles')}
          </Checkbox>
        </div>
        <div className="train-tags">
          <Input
            id="train-header-tags-input"
            small
            label={t('manageTrainSchedule.trainHeader.form.tags')}
            value={train?.labels?.join(', ') ?? ''}
            disabled
          />
        </div>

        <div className="actions">
          <Button
            label={t('manageTrainSchedule.trainHeader.itinerary')}
            variant="Quiet"
            onClick={() => {}}
            size="small"
            isDisabled
          />
        </div>
      </div>
    </div>
  );
};

export default ExpandedTrainForm;
