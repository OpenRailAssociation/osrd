import { Button } from '@osrd-project/ui-core';
import { ChevronDown } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import type { PacedTrainWithPaced } from 'applications/operationalStudies/types';
import type { Train } from 'reducers/osrdconf/types';
import { useDateTimeLocale } from 'utils/date';
import { findExceptionInPacedTrainByOccurenceId } from 'utils/trainExceptions';
import { isOccurrenceId } from 'utils/trainId';

import {
  getServiceInterval,
  getServiceWindow,
  getShortCategoryName,
  getShortDepartureDate,
} from './utils/trainProperties';

export type CollapsedTrainOverviewProps = {
  train: Train;
  onExpand: () => void;
  onItineraryOpened: () => void;
};

/**
 * A simple line that shows an overview of the key properties of a train.
 */
const CollapsedTrainOverview = ({
  train,
  onExpand,
  onItineraryOpened,
}: CollapsedTrainOverviewProps) => {
  const { t } = useTranslation(['operational-studies', 'translation']);
  const dateTimeLocale = useDateTimeLocale();

  const pacedTrain = train.paced ? (train as PacedTrainWithPaced) : null;
  const occurenceId = isOccurrenceId(train.id) ? train.id : null;
  const exception =
    occurenceId && pacedTrain
      ? findExceptionInPacedTrainByOccurenceId(occurenceId, pacedTrain)
      : null;

  return (
    <div className="train-header collapsed-train-summary">
      {pacedTrain && (
        <div className="train-kind-header">
          {occurenceId
            ? t('manageTrainSchedule.trainHeader.serviceOccurrence')
            : t('manageTrainSchedule.trainHeader.serviceModelTrain')}
          {exception && ' ≠'}
        </div>
      )}
      <div className="train-metadata">
        {pacedTrain && !occurenceId && (
          <div className="train-service-cadence">
            {getServiceInterval(pacedTrain)}’ — {getServiceWindow(pacedTrain)}’
          </div>
        )}
        <div className="train-departure-date">{getShortDepartureDate(train, dateTimeLocale)}</div>
        <div className="train-category">{getShortCategoryName(train, t)}</div>
        {train.rolling_stock_name && (
          <div className="train-rolling-stock">{train.rolling_stock_name}</div>
        )}
        {train.speed_limit_tag && (
          <div className="train-composition-code">{train.speed_limit_tag}</div>
        )}
        <div className="train-recovery-margin">
          {train.constraint_distribution === 'MARECO'
            ? t('manageTrainSchedule.trainHeader.allowances.mareco')
            : t('manageTrainSchedule.trainHeader.allowances.linear')}
        </div>
      </div>
      <div className="actions">
        <Button
          label={t('manageTrainSchedule.trainHeader.itinerary')}
          variant="Quiet"
          onClick={onItineraryOpened}
          size="small"
        />
      </div>
      <button className="header-toggle" onClick={() => onExpand()}>
        <ChevronDown />
      </button>
    </div>
  );
};

export default CollapsedTrainOverview;
