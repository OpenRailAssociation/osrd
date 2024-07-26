import React, { useEffect, useState } from 'react';

import { Gear, ShieldCheck } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { ModalBodySNCF, ModalHeaderSNCF } from 'common/BootstrapSNCF/ModalSNCF';
import SwitchSNCF, { SWITCH_TYPES } from 'common/BootstrapSNCF/SwitchSNCF/SwitchSNCF';
import { updateUserPreferences, switchStdcmV2Activated } from 'reducers/user';
import { getUserPreferences, getStdcmV2Activated } from 'reducers/user/userSelectors';
import { useAppDispatch } from 'store';
import { useDebounce } from 'utils/helpers';

const UserSettings = () => {
  const userPreferences = useSelector(getUserPreferences);
  const stdcmV2Activated = useSelector(getStdcmV2Activated);
  const [safeWordText, setSafeWordText] = useState(userPreferences.safeWord);
  const dispatch = useAppDispatch();

  const debouncedSafeWord = useDebounce(safeWordText, 500);

  useEffect(() => {
    dispatch(updateUserPreferences({ ...userPreferences, safeWord: debouncedSafeWord }));
  }, [debouncedSafeWord]);

  const { t } = useTranslation(['home/navbar']);
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

        <div className="col-lg-8">
          <div className="d-flex align-items-center mt-3">
            <SwitchSNCF
              id="stdcm-version-switch"
              type={SWITCH_TYPES.switch}
              name="stdcm-version-switch"
              onChange={() => {
                dispatch(switchStdcmV2Activated());
              }}
              checked={stdcmV2Activated}
            />
            <p className="ml-3">{t('stdcmToggle')}</p>
          </div>
        </div>
      </ModalBodySNCF>
    </>
  );
};

export default UserSettings;
