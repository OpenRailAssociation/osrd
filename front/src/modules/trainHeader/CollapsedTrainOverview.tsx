import { Button } from '@osrd-project/ui-core';
import { ChevronDown } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type { PacedTrain } from 'applications/operationalStudies/types';
import { useSubCategoryContext } from 'common/SubCategoryContext';
import type { Train } from 'reducers/osrdconf/types';
import { useDateTimeLocale } from 'utils/date';
import { findExceptionInPacedTrainByOccurrenceId } from 'utils/trainExceptions';
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
  const { scenario } = useScenarioContext();
  const dateTimeLocale = useDateTimeLocale();

  const pacedTrain = train.paced ? (train as PacedTrain) : null;
  const occurrenceId = isOccurrenceId(train.id) ? train.id : null;
  const exception =
    occurrenceId && pacedTrain
      ? findExceptionInPacedTrainByOccurrenceId(occurrenceId, pacedTrain)
      : null;
  const subCategories = useSubCategoryContext();

  return (
    <div className="train-header collapsed-train-summary" data-testid="train-header-collapsed">
      {pacedTrain && (
        <div className="train-kind-header" data-testid="train-header-kind">
          {occurrenceId
            ? t('manageTrainSchedule.trainHeader.serviceOccurrence')
            : t('manageTrainSchedule.trainHeader.serviceModelTrain')}
          {exception && ' ≠'}
        </div>
      )}
      <div className="train-metadata">
        {pacedTrain && !occurrenceId && (
          <div className="train-service-interval" data-testid="train-service-interval">
            {getServiceInterval(pacedTrain)}’ — {getServiceWindow(pacedTrain)}’
          </div>
        )}
        {scenario.timetable_type === 'CALENDAR' && (
          <div className="train-departure-date" data-testid="train-departure-date">
            {getShortDepartureDate(train, dateTimeLocale)}
          </div>
        )}
        <div className="train-category" data-testid="train-category">
          {getShortCategoryName(train, t, subCategories)}
        </div>
        {train.rolling_stock_name && (
          <div className="train-rolling-stock" data-testid="train-rolling-stock">
            {train.rolling_stock_name}
          </div>
        )}
        {train.speed_limit_tag && (
          <div className="train-composition-code" data-testid="train-composition-code">
            {train.speed_limit_tag}
          </div>
        )}
        <div className="train-recovery-margin" data-testid="train-recovery-margin">
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
          dataTestID="train-header-itinerary-button"
        />
      </div>
      <button
        className="header-toggle"
        onClick={() => onExpand()}
        data-testid="train-header-expand-toggle"
      >
        <ChevronDown />
      </button>
    </div>
  );
};

export default CollapsedTrainOverview;
