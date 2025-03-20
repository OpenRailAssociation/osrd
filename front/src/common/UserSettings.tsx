import { useEffect, useState } from 'react';

import { ComboBox, useDefaultComboBox } from '@osrd-project/ui-core';
import { Gear, ShieldCheck } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { ModalBodySNCF, ModalHeaderSNCF } from 'common/BootstrapSNCF/ModalSNCF';
import {
  setImpersonatedUser,
  setUserName,
  setUserRoles,
  updateUserPreferences,
} from 'reducers/user';
import {
  getIsSuperUser,
  getImpersonatedUser,
  getUsername,
  getUserPreferences,
} from 'reducers/user/userSelectors';
import { useAppDispatch } from 'store';
import { useDebounce } from 'utils/helpers';

import { addTagTypes, type Role } from './api/generatedEditoastApi';
import { osrdEditoastApi } from './api/osrdEditoastApi';
import SwitchSNCF from './BootstrapSNCF/SwitchSNCF';

// TODO: Delete this when #11197 is merged
export type Subject = {
  id: number;
  name: string;
  type: Role[];
};

const mockedSubjects: Subject[] = [
  { id: 1, name: 'Exemple User', type: ['Admin'] },
  { id: 2, name: 'Bob Smith', type: ['Stdcm'] },
  { id: 3, name: 'Charlie Brown', type: ['OperationalStudies'] },
  { id: 4, name: 'Diana Prince', type: ['Admin'] },
  { id: 5, name: 'Ethan Carter', type: ['Stdcm'] },
  { id: 6, name: 'Fiona Gallagher', type: ['OperationalStudies'] },
  { id: 7, name: 'George Lucas', type: ['Admin'] },
  { id: 8, name: 'Hannah Baker', type: ['Stdcm'] },
  { id: 9, name: 'Isaac Newton', type: ['OperationalStudies'] },
  { id: 10, name: 'Julia Roberts', type: ['Admin'] },
  { id: 11, name: 'Kevin Hart', type: ['Stdcm'] },
  { id: 12, name: 'Lana Del Rey', type: ['OperationalStudies'] },
];

const UserSettings = () => {
  const userPreferences = useSelector(getUserPreferences);
  const [safeWordText, setSafeWordText] = useState(userPreferences.safeWord);
  const dispatch = useAppDispatch();
  const isSuperUser = useSelector(getIsSuperUser);
  const username = useSelector(getUsername);
  const impersonatedUser = useSelector(getImpersonatedUser);

  const debouncedSafeWord = useDebounce(safeWordText, 500);

  const userComboBoxDefaultProps = useDefaultComboBox(mockedSubjects, (subject) => subject.name);

  const handleSubjectSelection = (subject: Subject | undefined) => {
    if (subject) {
      dispatch(setUserRoles(subject.type));
      dispatch(setUserName(subject.name));
      dispatch(setImpersonatedUser(subject));
      const tagsToInvalidate = addTagTypes.map((tag) => ({ type: tag }));
      dispatch(osrdEditoastApi.util.invalidateTags(tagsToInvalidate));
    }
  };

  const getSubjectConnected = (name: string): Subject | undefined =>
    impersonatedUser?.name === name ? impersonatedUser : undefined;

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
        {isSuperUser && (
          <>
            <div className="font-weight-medium mb-2 mt-2">{t('impersonation')}</div>
            <ComboBox
              id="impersonation"
              value={getSubjectConnected(username)}
              getSuggestionLabel={(subject) => subject.name}
              onSelectSuggestion={handleSubjectSelection}
              {...userComboBoxDefaultProps}
              autoComplete="off"
              narrow
            />
          </>
        )}
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
              <div className="ml-2">{t('operationalStudies/scenario:timetable.pacedTrain')}</div>
            </div>
          )
        }
      </ModalBodySNCF>
    </>
  );
};

export default UserSettings;
