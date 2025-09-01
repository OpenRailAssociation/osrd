import { useCallback, useContext, useEffect, useState } from 'react';

import { ComboBox, useDefaultComboBox } from '@osrd-project/ui-core';
import { Gear, ShieldCheck } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import {
  osrdEditoastApi,
  type SearchResultItemUser,
  type PostSearchApiArg,
} from 'common/api/osrdEditoastApi';
import useAuthz from 'common/authorization/hooks/useAuthz';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { ModalBodySNCF, ModalHeaderSNCF } from 'common/BootstrapSNCF/ModalSNCF';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { updateUserPreferences } from 'reducers/user';
import { getUserPreferences } from 'reducers/user/userSelectors';
import { useAppDispatch } from 'store';
import { useDebounce } from 'utils/helpers';
import useAuth from 'utils/hooks/useAuth';

const UserSettings = () => {
  const [postSearch] = osrdEditoastApi.endpoints.postSearch.useMutation();
  const [inputValue, setInputValue] = useState('');
  const [userList, setUserList] = useState<SearchResultItemUser[]>([]);
  const userPreferences = useSelector(getUserPreferences);
  const [safeWordText, setSafeWordText] = useState(userPreferences.safeWord);
  const dispatch = useAppDispatch();
  const { closeModal } = useContext(ModalContext);
  const { isSuperUser } = useAuthz();
  const { impersonatedUser, impersonate } = useAuth();

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

  const handleSubjectSelection = useCallback(
    (subject: SearchResultItemUser | undefined) => {
      if (subject) {
        impersonate(subject);
        closeModal();
      }
    },
    [impersonate, closeModal]
  );

  useEffect(() => {
    dispatch(updateUserPreferences({ ...userPreferences, safeWord: debouncedSafeWord }));
  }, [debouncedSafeWord]);

  const { t } = useTranslation(['translation', 'operational-studies']);
  return (
    <>
      <ModalHeaderSNCF withCloseButton>
        <h1 className="d-flex align-items-center">
          <Gear variant="fill" size="lg" />
          <span className="ml-2">{t('nav-bar.userSettings')}</span>
        </h1>
      </ModalHeaderSNCF>
      <ModalBodySNCF>
        <InputSNCF
          id="safe-word-input"
          label={t('nav-bar.safeWord')}
          clearButton
          onClear={() => {
            dispatch(updateUserPreferences({ ...userPreferences, safeWord: '' }));
            setSafeWordText('');
          }}
          placeholder={t('nav-bar.yourSafeWord')}
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
          {t('nav-bar.safeWordHelp')}
        </small>
        {isSuperUser && !impersonatedUser && (
          <>
            <div className="font-weight-medium mb-2 mt-2">{t('nav-bar.impersonation')}</div>
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
      </ModalBodySNCF>
    </>
  );
};

export default UserSettings;
