import { ArrowBoth, ThreeBars } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { updateTimeWindow, updateInterval } from 'reducers/osrdconf/operationalStudiesConf';
import { getTimeWindow, getInterval } from 'reducers/osrdconf/operationalStudiesConf/selectors';
import { useAppDispatch } from 'store';
import { Duration } from 'utils/duration';

import AddedOccurrences from './AddedOccurrences';
import { MAX_TIMEWINDOW_MINUTES } from '../consts';

const PacedTrainSettings = () => {
  const timeWindow = useSelector(getTimeWindow).total('minute');
  const interval = useSelector(getInterval).total('minute');
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTimetableItem' });
  const dispatch = useAppDispatch();

  return (
    <div className="paced-train-settings">
      <div className="time-settings">
        <span className="mr-3 time-settings-item">
          <InputSNCF
            type="number"
            label={
              <>
                <ArrowBoth className="input-icon" />
                <small className="text-nowrap">{t('pacedTrains.timeWindow')}</small>
              </>
            }
            id="paced-train-time-window"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              dispatch(updateTimeWindow(new Duration({ minutes: +e.target.value })));
            }}
            value={timeWindow}
            noMargin
            isInvalid={timeWindow < 1 || timeWindow >= MAX_TIMEWINDOW_MINUTES}
            errorMsg={
              timeWindow < 1
                ? t('errorMessages.tooLowInput')
                : timeWindow >= MAX_TIMEWINDOW_MINUTES
                  ? t('errorMessages.tooHighInput', { max: MAX_TIMEWINDOW_MINUTES })
                  : undefined
            }
            min={1}
            max={MAX_TIMEWINDOW_MINUTES}
            unit="min"
            textRight
            sm
          />
        </span>
        <span className="time-settings-item">
          <InputSNCF
            type="number"
            label={
              <>
                <ThreeBars className="input-icon cadence-icon" />
                <small className="text-nowrap">{t('pacedTrains.interval')}</small>
              </>
            }
            id="paced-train-interval"
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
      <AddedOccurrences />
    </div>
  );
};

export default PacedTrainSettings;
