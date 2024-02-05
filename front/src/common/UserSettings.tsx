import React, { useEffect, useState } from 'react';
import { ModalBodySNCF, ModalHeaderSNCF } from 'common/BootstrapSNCF/ModalSNCF';
import { FaCog } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { updateUserPreferences } from 'reducers/user';
import { AiFillSafetyCertificate } from 'react-icons/ai';
import cx from 'classnames';
import { useDebounce } from 'utils/helpers';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useAppDispatch } from 'store';
import { getUserPreferences } from 'reducers/user/userSelectors';

export default function UserSettings() {
  const userPreferences = useSelector(getUserPreferences);
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
        <h1>
          <FaCog />
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
              <AiFillSafetyCertificate />
            </span>
          }
        />
        <small id="safeWordHelpBlock" className="form-text text-muted">
          {t('safeWordHelp')}
        </small>
      </ModalBodySNCF>
    </>
  );
}
