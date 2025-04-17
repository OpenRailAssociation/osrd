import { ArrowBoth } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { updateTimeWindow, updateInterval } from 'reducers/osrdconf/operationalStudiesConf';
import { getTimeWindow, getInterval } from 'reducers/osrdconf/operationalStudiesConf/selectors';
import { useAppDispatch } from 'store';
import { Duration } from 'utils/duration';

const PacedTrainSettings = () => {
  const timeWindow = useSelector(getTimeWindow).total('minute');
  const interval = useSelector(getInterval).total('minute');
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const dispatch = useAppDispatch();

  return (
    <div className="d-flex px-3 mt-2">
      <span className="mr-3">
        <InputSNCF
          type="number"
          label={
            <>
              <ArrowBoth className="input-icon" />
              <small className="text-nowrap">{t('pacedTrains.timeRangeDuration')}</small>
            </>
          }
          id="paced-train-time-range-duration"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            dispatch(updateTimeWindow(new Duration({ minutes: +e.target.value })));
          }}
          value={timeWindow}
          noMargin
          isInvalid={timeWindow < 1}
          errorMsg={timeWindow < 1 ? t('errorMessages.tooLowInput') : undefined}
          min={1}
          unit="min"
          textRight
          sm
        />
      </span>
      <span>
        <InputSNCF
          type="number"
          label={
            <>
              <ArrowBoth className="input-icon" />
              <small className="text-nowrap">{t('pacedTrains.cadence')}</small>
            </>
          }
          id="paced-train-cadence"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            dispatch(updateInterval(new Duration({ minutes: +e.target.value })));
          }}
          value={interval}
          noMargin
          isInvalid={interval < 1}
          errorMsg={interval < 1 ? t('errorMessages.tooLowInput') : undefined}
          min={1}
          unit="min"
          textRight
          sm
        />
      </span>
    </div>
  );
};

export default PacedTrainSettings;
