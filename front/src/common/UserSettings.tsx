import React, { useEffect, useState } from 'react';

import { Gear, ShieldCheck } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { ModalBodySNCF, ModalHeaderSNCF } from 'common/BootstrapSNCF/ModalSNCF';
import SwitchSNCF, { switch_types } from 'common/BootstrapSNCF/SwitchSNCF/SwitchSNCF';
import { operationalStudiesConfSliceActions } from 'reducers/osrdconf/operationalStudiesConf';
import { stdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import {
  updateUserPreferences,
  switchTrainScheduleV2Activated,
  switchStdcmV2Activated,
} from 'reducers/user';
import {
  getTrainScheduleV2Activated,
  getUserPreferences,
  getStdcmV2Activated,
} from 'reducers/user/userSelectors';
import { useAppDispatch } from 'store';
import { useDebounce } from 'utils/helpers';

const UserSettings = () => {
  const userPreferences = useSelector(getUserPreferences);
  const trainScheduleV2Activated = useSelector(getTrainScheduleV2Activated);
  const stdcmV2Activated = useSelector(getStdcmV2Activated);
  const [safeWordText, setSafeWordText] = useState(userPreferences.safeWord);
  const dispatch = useAppDispatch();

  const debouncedSafeWord = useDebounce(safeWordText, 500);

  const {
    updateScenarioID: updateEexScenarioId,
    updateTimetableID: updateEexTimetableId,
    updateInfraID: updateEexInfraId,
  } = operationalStudiesConfSliceActions;
  const {
    updateScenarioID: updateStdcmScenarioId,
    updateTimetableID: updateStdcmTimetableId,
    updateInfraID: updateStdcmInfraId,
  } = stdcmConfSliceActions;

  const resetStore = () => {
    dispatch(updateEexScenarioId(undefined));
    dispatch(updateEexTimetableId(undefined));
    dispatch(updateEexInfraId(undefined));

    dispatch(updateStdcmScenarioId(undefined));
    dispatch(updateStdcmTimetableId(undefined));
    dispatch(updateStdcmInfraId(undefined));
  };

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
        <div className="col-lg-6">
          <div className="d-flex align-items-center mt-3">
            <SwitchSNCF
              id="train-schedule-version-switch"
              type={switch_types.switch}
              name="train-schedule-version-switch"
              onChange={() => {
                dispatch(switchTrainScheduleV2Activated());
                resetStore();
              }}
              checked={trainScheduleV2Activated}
            />
            <p className="ml-3">TrainSchedule V2</p>
          </div>
        </div>
        <div className="col-lg-8">
          <div className="d-flex align-items-center mt-3">
            <SwitchSNCF
              id="stdcm-version-switch"
              type={switch_types.switch}
              name="stdcm-version-switch"
              onChange={() => {
                dispatch(switchStdcmV2Activated());
                resetStore();
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
