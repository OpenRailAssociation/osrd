import { useContext, useEffect, useState } from 'react';

import { ComboBox, useDefaultComboBox } from '@osrd-project/ui-core';
import { Gear, ShieldCheck } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { ModalBodySNCF, ModalHeaderSNCF } from 'common/BootstrapSNCF/ModalSNCF';
import { setImpersonatedUser, updateUserPreferences } from 'reducers/user';
import {
  getIsSuperUser,
  getImpersonatedUser,
  getUserPreferences,
} from 'reducers/user/userSelectors';
import { useAppDispatch } from 'store';
import { useDebounce } from 'utils/helpers';

import {
  addTagTypes,
  type PostSearchApiArg,
  type SearchResultItemUser,
} from './api/generatedEditoastApi';
import { osrdEditoastApi } from './api/osrdEditoastApi';
import { ModalContext } from './BootstrapSNCF/ModalSNCF/ModalProvider';
import SwitchSNCF from './BootstrapSNCF/SwitchSNCF';

const UserSettings = () => {
  const [postSearch] = osrdEditoastApi.endpoints.postSearch.useMutation();
  const [inputValue, setInputValue] = useState('');
  const [userList, setUserList] = useState<SearchResultItemUser[]>([]);
  const userPreferences = useSelector(getUserPreferences);
  const [safeWordText, setSafeWordText] = useState(userPreferences.safeWord);
  const dispatch = useAppDispatch();
  const { closeModal } = useContext(ModalContext);
  const isSuperUser = useSelector(getIsSuperUser);
  const impersonatedUser = useSelector(getImpersonatedUser);
  const tagsToInvalidate = addTagTypes.map((tag) => ({ type: tag }));

  const debouncedSafeWord = useDebounce(safeWordText, 500);

  const getUserList = async (input: string) => {
    const payload: PostSearchApiArg = {
      pageSize: 1,
      searchPayload: {
        object: 'user',
        query: ['search', ['name'], input],
      },
    };
    try {
      const user = (await postSearch(payload).unwrap()) as SearchResultItemUser[];
      setUserList(user);
    } catch (error) {
      setUserList([]);
      setInputValue('');
      console.error('Error while fetching user list', error);
    }
  };

  useEffect(() => {
    if (!impersonatedUser) getUserList(inputValue);
  }, [inputValue, impersonatedUser]);

  const userComboBoxDefaultProps = useDefaultComboBox(userList, (subject) => subject.name);

  const handleSubjectSelection = (subject: SearchResultItemUser | undefined) => {
    if (subject) {
      dispatch(setImpersonatedUser(subject));
      dispatch(osrdEditoastApi.util.invalidateTags(tagsToInvalidate));
      closeModal();
    }
  };

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
        {isSuperUser && !impersonatedUser && (
          <>
            <div className="font-weight-medium mb-2 mt-2">{t('impersonation')}</div>
            <ComboBox
              id="impersonation"
              value={impersonatedUser}
              getSuggestionLabel={(subject) => subject.name}
              onSelectSuggestion={handleSubjectSelection}
              {...userComboBoxDefaultProps}
              autoComplete="off"
              narrow
              onChange={(e) => {
                setInputValue(e.target.value);
              }}
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
