import { useEffect, useState } from 'react';

import { Gear, ShieldCheck } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { ModalBodySNCF, ModalHeaderSNCF } from 'common/BootstrapSNCF/ModalSNCF';
import { updateUserPreferences } from 'reducers/user';
import { getIsSuperUser, getUserPreferences } from 'reducers/user/userSelectors';
import { useAppDispatch } from 'store';
import { useDebounce } from 'utils/helpers';

import SwitchSNCF from './BootstrapSNCF/SwitchSNCF/SwitchSNCF';

const UserSettings = () => {
  const userPreferences = useSelector(getUserPreferences);
  const [safeWordText, setSafeWordText] = useState(userPreferences.safeWord);
  const dispatch = useAppDispatch();
  const isSuperUser = useSelector(getIsSuperUser);

  const debouncedSafeWord = useDebounce(safeWordText, 500);

  useEffect(() => {
    dispatch(updateUserPreferences({ ...userPreferences, safeWord: debouncedSafeWord }));
  }, [debouncedSafeWord]);

  const { t } = useTranslation(['home/navbar', 'operationalStudies/scenario']);
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
        {
          // TODO PACEDTRAIN: Remove switch after development pacedTrain feature
          isSuperUser && (
            <div className="d-flex align-items-center mt-2">
              <SwitchSNCF
                id="paced-train-switch"
                type="switch"
                name="paced-train-switch"
                checked={userPreferences.showPacedTrains}
                onChange={() =>
                  dispatch(
                    updateUserPreferences({
                      ...userPreferences,
                      showPacedTrains: !userPreferences.showPacedTrains,
                    })
                  )
                }
              />
              <div className="ml-2">{t('operationalStudies/scenario:pacedTrain.pacedTrain')}</div>
            </div>
          )
        }
      </ModalBodySNCF>
    </>
  );
};

export default UserSettings;
