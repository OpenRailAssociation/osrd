import { Comment } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { getSelectedSimulation } from 'reducers/osrdconf/stdcmConf/selectors';
import useDeploymentSettings from 'utils/hooks/useDeploymentSettings';

const StdcmFeedback = () => {
  const { t } = useTranslation('stdcm');
  const { stdcmName, stdcmFeedbackMail } = useDeploymentSettings() ?? { stdcmName: 'STDCM' };
  const selectedSimulation = useSelector(getSelectedSimulation);

  const { inputs } = selectedSimulation;
  const { departureTime } = inputs;
  const data = inputs.consist;

  const trainName = data?.tractionEngine?.name ?? '-';
  const consistCode = data?.speedLimitByTag ?? '-';
  const consistLength = data?.totalLength ? `${data.totalLength} m` : '-';
  const consistMass = data?.totalMass ? `${data.totalMass} t` : '-';
  const maxSpeed = data?.maxSpeed ? `${Math.round(data.maxSpeed * 3.6)} km/h` : '-';

  const origin = inputs.pathSteps[0]?.location?.name ?? '-';
  const destination = inputs.pathSteps.at(-1)?.location?.name ?? '-';

  const subject = encodeURIComponent(t('mailFeedback.subject', { stdcmName }));
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

${t('mailFeedback.body', { stdcmName })}

${separator}
`;

  const body = encodeURIComponent(messageContent);

  const mailtoLink = `mailto:${stdcmFeedbackMail}?subject=${subject}&body=${body}`;

  return (
    <div className="feedback-card" data-testid="feedback-card">
      <div className="feedback-separator" />
      <div className="feedback-card-header">
        <h3 data-testid="feedback-title">
          {t('mailFeedback.title')}
          <Comment className="feedback-card-header-icon" size="sm" />
        </h3>
      </div>
      <p className="feedback-card-text" data-testid="feedback-card-text">
        {t('mailFeedback.description', { stdcmName })}
        <br />
        <strong>
          <a data-testid="feedback-button" href={mailtoLink}>
            {t('mailFeedback.writeButton')}
          </a>
        </strong>
      </p>
    </div>
  );
};

export default StdcmFeedback;
