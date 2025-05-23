import { useCallback, useMemo, useState } from 'react';

import { ComboBox, Select } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

import { ThreeDots } from 'common/Loaders';
import type { AsyncStatus } from 'common/types';
import type { User } from 'common/useSearchUsers';
import useSearchUsers from 'common/useSearchUsers';

import type { Grant } from '../types';

type AddUserForm = {
  user: User;
  grant: Grant;
};

type GrantManagerAddSubjectFormProps = {
  grants: Array<{ label: string; value?: Grant }>;
  onSubmit(user: User, grant: Grant): Promise<void>;
};
const GrantManagerAddSubjectForm = ({
  grants: grantOptions,
  onSubmit,
}: GrantManagerAddSubjectFormProps) => {
  const { t } = useTranslation();
  const [addUserForm, setAddUserForm] = useState<Partial<AddUserForm>>({ grant: 'READER' });
  const { searchedUsers, setSearchTerm, resetSuggestions } = useSearchUsers();
  const [addUserStatus, setAddUserStatus] = useState<AsyncStatus>({ type: 'idle' });

  const isAddUserFormValid = useMemo(() => addUserForm.user && addUserForm.grant, [addUserForm]);
  const searchSubmit = useCallback(async () => {
    if (isAddUserFormValid) {
      try {
        await onSubmit(addUserForm.user!, addUserForm.grant!);
        resetSuggestions();
        setAddUserForm({});
        setAddUserStatus({ type: 'success' });
      } catch (e) {
        console.error(e);
        setAddUserStatus({ type: 'error' });
      }
    }
  }, [addUserForm, isAddUserFormValid, onSubmit]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        searchSubmit();
      }}
    >
      <div className="subject-search-section">
        <span className="subject-search-combobox">
          <ComboBox
            id="add-user-combobox"
            value={addUserForm.user}
            suggestions={searchedUsers}
            getSuggestionLabel={(option) => option.name}
            onChange={(e) => setSearchTerm(e.target.value)}
            onSelectSuggestion={(suggestion) => {
              setAddUserForm((prev) => ({ ...prev, user: suggestion }));
            }}
            resetSuggestions={() => {}}
            placeholder={t('authorization.searchUser')}
            autoComplete="off"
            narrow
          />
        </span>
        <span className="subject-grant">
          <Select
            id="add-user-grant-selector"
            getOptionLabel={(option) => option.label}
            getOptionValue={(option) => option.value || ''}
            onChange={(option) => {
              setAddUserForm((prev) => ({ ...prev, grant: option?.value }));
            }}
            options={grantOptions}
            value={grantOptions.find((option) => option.value === addUserForm.grant)}
            narrow
          />
        </span>
      </div>
      <div className="subject-search-actions">
        <button
          type="submit"
          className="subject-search-add-button"
          disabled={addUserStatus.type === 'loading' || !isAddUserFormValid}
        >
          {addUserStatus.type === 'loading' ? <ThreeDots /> : t('common.add')}
        </button>
      </div>
    </form>
  );
};

export default GrantManagerAddSubjectForm;
