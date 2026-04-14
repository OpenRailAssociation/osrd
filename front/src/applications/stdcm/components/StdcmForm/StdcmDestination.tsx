import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { getStdcmDestination, getStdcmPathSteps } from 'reducers/osrdconf/stdcmConf/selectors';

import type { StdcmItineraryProps } from '../../types';
import StdcmCardMarkerIcon from '../StdcmCardMarkerIcon';
import StdcmCard from './StdcmCard';
import StdcmOperationalPoint from './StdcmOperationalPoint';
import StdcmOpSchedule from './StdcmOpSchedule';

const StdcmDestination = ({ disabled = false, onItineraryChange }: StdcmItineraryProps) => {
  const { t } = useTranslation('stdcm');

  const destination = useSelector(getStdcmDestination);
  const pathSteps = useSelector(getStdcmPathSteps);

  return (
    <StdcmCard
      data-testid="destination-card"
      name={t('trainPath.destination')}
      title={<StdcmCardMarkerIcon markerIndex={pathSteps.length} />}
      disabled={disabled}
      className="stdcm-card-destination extremity"
      testId="stdcm-card-destination"
    >
      <StdcmOperationalPoint
        operationalPoint={destination.operationalPoint}
        pathStepId={destination.id}
        disabled={disabled}
        onItineraryChange={onItineraryChange}
      />
      <StdcmOpSchedule pathStep={destination} disabled={disabled} opId="destination-arrival" />
    </StdcmCard>
  );
};

export default StdcmDestination;
