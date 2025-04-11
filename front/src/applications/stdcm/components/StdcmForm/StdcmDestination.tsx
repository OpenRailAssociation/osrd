import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import DestinationIcon from 'assets/pictures/mapMarkers/destination.svg';
import { getStdcmDestination } from 'reducers/osrdconf/stdcmConf/selectors';

import StdcmCard from './StdcmCard';
import StdcmOperationalPoint from './StdcmOperationalPoint';
import StdcmOpSchedule from './StdcmOpSchedule';
import type { StdcmItineraryProps } from '../../types';

const StdcmDestination = ({ disabled = false, onItineraryChange }: StdcmItineraryProps) => {
  const { t } = useTranslation('stdcm');

  const destination = useSelector(getStdcmDestination);

  return (
    <StdcmCard
      data-testid="destination-card"
      name={t('trainPath.destination')}
      title={<img src={DestinationIcon} alt="destination" className="stdcm-destination-icon" />}
      disabled={disabled}
      className="extremity"
      testId="stdcm-card-destination"
    >
      <StdcmOperationalPoint
        location={destination.location}
        pathStepId={destination.id}
        disabled={disabled}
        onItineraryChange={onItineraryChange}
      />
      <StdcmOpSchedule pathStep={destination} disabled={disabled} opId="destination-arrival" />
    </StdcmCard>
  );
};

export default StdcmDestination;
