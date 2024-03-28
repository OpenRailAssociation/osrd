import React, { useEffect, useState } from 'react';

import { Gear, ShieldCheck } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { ModalBodySNCF, ModalHeaderSNCF } from 'common/BootstrapSNCF/ModalSNCF';
import SwitchSNCF, { SWITCH_TYPES } from 'common/BootstrapSNCF/SwitchSNCF/SwitchSNCF';
import { updateUserPreferences, switchTrainScheduleV2Activated } from 'reducers/user';
import { getTrainScheduleV2Activated, getUserPreferences } from 'reducers/user/userSelectors';
import { useAppDispatch } from 'store';
import { useDebounce } from 'utils/helpers';

export default function UserSettings() {
  const userPreferences = useSelector(getUserPreferences);
  const trainScheduleV2Activated = useSelector(getTrainScheduleV2Activated);
  const [safeWordText, setSafeWordText] = useState(userPreferences.safeWord);
  const dispatch = useAppDispatch();

  const debouncedSafeWord = useDebounce(safeWordText, 500);

  useEffect(() => {
    dispatch(updateUserPreferences({ ...userPreferences, safeWord: debouncedSafeWord }));
  }, [debouncedSafeWord]);

  const { t } = useTranslation('home/navbar');
  return (
    <>
      <ModalHeaderSNCF withCloseButton>
        <h1 className="d-flex align-items-center">
          <Gear variant="fill" size="lg" />
          <span className="ml-2">{t('userSettings')}</span>
        </h1>
      </ModalHeaderSNCF>
      <ModalBodySNCF>
        <InputSNCF
          id="safe-word-input"
          label={t('safeWord')}
          clearButton
          onClear={() => {
            dispatch(updateUserPreferences({ ...userPreferences, safeWord: '' }));
            setSafeWordText('');
          }}
          placeholder={t('yourSafeWord')}
          onChange={(e) => setSafeWordText(e.target.value)}
          value={safeWordText}
          type="text"
          noMargin
          unit={
            <span className={cx('lead', safeWordText !== '' && 'text-success')}>
              <ShieldCheck />
            </span>
          }
        />
        <small id="safeWordHelpBlock" className="form-text text-muted">
          {t('safeWordHelp')}
        </small>
        <div className="col-lg-6">
          <div className="d-flex align-items-center mt-3">
            <SwitchSNCF
              id="train-schedule-version-switch"
              type={SWITCH_TYPES.switch}
              name="train-schedule-version-switch"
              onChange={() => dispatch(switchTrainScheduleV2Activated())}
              checked={trainScheduleV2Activated}
            />
            <p className="ml-3">TrainSchedule V2</p>
          </div>
        </div>
      </ModalBodySNCF>
    </>
  );
}
