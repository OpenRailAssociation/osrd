import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import OriginIcon from 'assets/pictures/mapMarkers/start.svg';
import { getStdcmOrigin } from 'reducers/osrdconf/stdcmConf/selectors';

import StdcmCard from './StdcmCard';
import StdcmOperationalPoint from './StdcmOperationalPoint';
import StdcmOpSchedule from './StdcmOpSchedule';
import type { StdcmItineraryProps } from '../../types';

const StdcmOrigin = ({ disabled = false, onItineraryChange }: StdcmItineraryProps) => {
  const { t } = useTranslation('stdcm');

  const origin = useSelector(getStdcmOrigin);

  return (
    <StdcmCard
      name={t('trainPath.origin')}
      title={<img src={OriginIcon} alt="origin" className="stdcm-origin-icon" />}
      className="extremity"
      disabled={disabled}
      hasTip
      testId="stdcm-card-origin"
    >
      <StdcmOperationalPoint
        location={origin.location}
        pathStepId={origin.id}
        disabled={disabled}
        onItineraryChange={onItineraryChange}
      />
      <StdcmOpSchedule pathStep={origin} disabled={disabled} opId="origin-arrival" isOrigin />
    </StdcmCard>
  );
};

export default StdcmOrigin;
