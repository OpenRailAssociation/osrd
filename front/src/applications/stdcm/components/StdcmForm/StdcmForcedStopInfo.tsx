import { Info } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { getForcedOpStops } from 'reducers/osrdconf/stdcmConf/selectors';

type StdcmForcedStopInfoProps = {
  operationalPointId?: string;
};

const StdcmForcedStopInfo = ({ operationalPointId }: StdcmForcedStopInfoProps) => {
  const { t } = useTranslation('stdcm');
  const forcedOpStops = useSelector(getForcedOpStops);

  const isGeneralStop = forcedOpStops.some(
    ({ id, stop_type }) => id === operationalPointId && stop_type === 'GENERAL_STOP'
  );

  if (!isGeneralStop) return null;

  return (
    <div className="forced-stop-info" data-testid="forced-stop-info" role="status">
      <Info variant="fill" size="lg" />
      <span>{t('trainPath.generalStopInfo')}</span>
    </div>
  );
};

export default StdcmForcedStopInfo;
