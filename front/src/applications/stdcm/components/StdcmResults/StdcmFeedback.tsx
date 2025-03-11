import { Button } from '@osrd-project/ui-core';
import { Comment } from '@osrd-project/ui-icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import type { StdcmResultsOutput } from 'applications/stdcm/types';
import { getSelectedSimulation } from 'reducers/osrdconf/stdcmConf/selectors';
import { dateTimeFormatting } from 'utils/date';

type StdcmFeedbackProps = {
  stdcmFeedbackMail?: string;
};

const StdcmFeedback = ({ stdcmFeedbackMail }: StdcmFeedbackProps) => {
  const { t } = useTranslation('stdcm');
  const selectedSimulation = useSelector(getSelectedSimulation);

  if (!selectedSimulation) {
    return null;
  }

  const resultsOutput = selectedSimulation.outputs as StdcmResultsOutput;
  const { rollingStock, speedLimitByTag } = resultsOutput.results;

  const trainName = rollingStock.name;
  const consistCode = speedLimitByTag;
  const consistLength = `${rollingStock.length} m`;
  const consistMass = `${rollingStock.mass / 1000} t`;
  const maxSpeed = `${Math.round(rollingStock.max_speed * 3.6)} km/h`;
  const origin = resultsOutput.results.simulationPathSteps[0]?.location?.name;
  const destination = resultsOutput.results.simulationPathSteps.at(-1)?.location?.name;
  const departureTime = dateTimeFormatting(
    dayjs.utc(resultsOutput.results.departure_time).toDate()
  );

  const subject = encodeURIComponent(t('mailFeedback.subject'));
  const separator = '********';

  const messageContent = `
${separator}

${t('mailFeedback.simulationDetails')}:

${t('consist.tractionEngine')}: ${trainName}
${t('consist.compositionCode')}: ${consistCode}
${t('consist.tonnage')}: ${consistMass}
${t('consist.length')}: ${consistLength}
${t('consist.maxSpeed')}: ${maxSpeed}

${t('trainPath.origin')}: ${origin}
${t('trainPath.destination')}: ${destination}
${t('departureTime')}: ${departureTime}

${separator}

${t('mailFeedback.body')}

${separator}
`;

  const body = encodeURIComponent(messageContent);

  const mailtoLink = `mailto:${stdcmFeedbackMail}?subject=${subject}&body=${body}`;

  const handleEmailClick = () => {
    window.location.href = mailtoLink;
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
        data-mailto={mailtoLink} // Expose mailto link for easier E2E testing
      />
    </div>
  );
};

export default StdcmFeedback;
