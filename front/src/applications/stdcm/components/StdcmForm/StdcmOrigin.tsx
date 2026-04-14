import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { getStdcmOrigin } from 'reducers/osrdconf/stdcmConf/selectors';

import type { StdcmItineraryProps } from '../../types';
import StdcmCardMarkerIcon from '../StdcmCardMarkerIcon';
import StdcmCard from './StdcmCard';
import StdcmOperationalPoint from './StdcmOperationalPoint';
import StdcmOpSchedule from './StdcmOpSchedule';

const StdcmOrigin = ({ disabled = false, onItineraryChange }: StdcmItineraryProps) => {
  const { t } = useTranslation('stdcm');

  const origin = useSelector(getStdcmOrigin);

  return (
    <StdcmCard
      name={t('trainPath.origin')}
      title={<StdcmCardMarkerIcon markerIndex={1} />}
      className="extremity"
      disabled={disabled}
      tip="bottom"
      testId="stdcm-card-origin"
    >
      <StdcmOperationalPoint
        operationalPoint={origin.operationalPoint}
        pathStepId={origin.id}
        disabled={disabled}
        onItineraryChange={onItineraryChange}
      />
      <StdcmOpSchedule pathStep={origin} disabled={disabled} opId="origin-arrival" isOrigin />
    </StdcmCard>
  );
};

export default StdcmOrigin;
