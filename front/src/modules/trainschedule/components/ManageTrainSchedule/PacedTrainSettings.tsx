import { ArrowBoth } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { updateTimeRangeDuration, updateCadence } from 'reducers/osrdconf/operationalStudiesConf';
import {
  getTimeRangeDuration,
  getCadence,
} from 'reducers/osrdconf/operationalStudiesConf/selectors';
import { useAppDispatch } from 'store';
import { Duration } from 'utils/duration';

const PacedTrainSettings = () => {
  const timeRangeDuration = useSelector(getTimeRangeDuration).total('minute');
  const cadence = useSelector(getCadence).total('minute');
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
            dispatch(updateTimeRangeDuration(new Duration({ minutes: +e.target.value })));
          }}
          value={timeRangeDuration}
          noMargin
          isInvalid={timeRangeDuration < 1}
          errorMsg={timeRangeDuration < 1 ? t('errorMessages.tooLowInput') : undefined}
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
            dispatch(updateCadence(new Duration({ minutes: +e.target.value })));
          }}
          value={cadence}
          noMargin
          isInvalid={cadence < 1}
          errorMsg={cadence < 1 ? t('errorMessages.tooLowInput') : undefined}
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
