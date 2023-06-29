import React, { useEffect, useState } from 'react';
import { ModalBodySNCF, ModalHeaderSNCF } from 'common/BootstrapSNCF/ModalSNCF';
import { FaCog } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from 'reducers';
import { updateSafeWord } from 'reducers/main';
import { AiFillSafetyCertificate } from 'react-icons/ai';
import cx from 'classnames';
import { useDebounce } from 'utils/helpers';
import InputSNCF from './BootstrapSNCF/InputSNCF';

export default function UserSettings() {
  const { safeWord } = useSelector((state: RootState) => state.main);
  const [safeWordText, setSafeWordText] = useState(safeWord);
  const dispatch = useDispatch();

  const debouncedSafeWord = useDebounce(safeWordText, 500);

  useEffect(() => {
    dispatch(updateSafeWord(debouncedSafeWord));
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
            dispatch(updateSafeWord(''));
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
