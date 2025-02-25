import { Button } from '@osrd-project/ui-core';
import { Comment } from '@osrd-project/ui-icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import type { StdcmResultsOutput } from 'applications/stdcm/types';
import { getSelectedSimulation } from 'reducers/osrdconf/stdcmConf/selectors';
import { dateTimeFormatting } from 'utils/date';

const FeedbackCard = () => {
  const { t } = useTranslation('stdcm');
  const selectedSimulation = useSelector(getSelectedSimulation);

  const resultsOutput = selectedSimulation.outputs as StdcmResultsOutput;
  const { rollingStock } = resultsOutput.results;
  const trainName = rollingStock.name;
  const consistCode = rollingStock?.metadata?.series;
  const consistLength = `${rollingStock.length} m`;
  const consistMass = `${rollingStock.mass / 1000} t`;
  const maxSpeed = `${Math.round(rollingStock.max_speed * 3.6)} km/h`;
  const origin = resultsOutput.results.simulationPathSteps[0]?.location?.name;
  const destination = resultsOutput.results.simulationPathSteps.at(-1)?.location?.name;
  const departureTime = dateTimeFormatting(
    dayjs.utc(resultsOutput.results.departure_time).toDate()
  );

  const handleEmailClick = () => {
    const subject = encodeURIComponent(t('mailFeedback.subject'));

    const trainInfo = encodeURIComponent(`

********

${t('mailFeedback.simulationDetails')}:

${t('consist.tractionEngine')}: ${trainName}
${t('consist.compositionCode')}: ${consistCode}
${t('consist.tonnage')}: ${consistMass}
${t('consist.length')}: ${consistLength}
${t('consist.maxSpeed')}: ${maxSpeed}

${t('trainPath.origin')}: ${origin}
${t('trainPath.destination')}: ${destination}
${t('departureTime')}: ${departureTime}
`);
    const body = `${trainInfo}${t('mailFeedback.body')}`;

    window.location.href = `mailto:support_LMR@reseau.sncf.fr?subject=${subject}&body=${body}`;
  };

  return (
    <div className="feedback-card">
      <div className="feedback-separator" />
      <div className="feedback-card-header">
        <h3 data-testid="feedback-title">
          {t('mailFeedback.title')}
          <Comment className="feedback-card-header-icon" size="sm" />
        </h3>
      </div>
      <p className="feedback-card-text">{t('mailFeedback.description')}</p>
      <Button
        data-testid="feedback-button"
        label={t('mailFeedback.writeButton')}
        variant="Cancel"
        size="medium"
        onClick={handleEmailClick}
      />
    </div>
  );
};

export default FeedbackCard;
