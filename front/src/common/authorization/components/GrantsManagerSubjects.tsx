import { useState } from 'react';

import { ComboBox, Select } from '@osrd-project/ui-core';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { Grant, PrivilegesByGrant, ResourceType } from 'common/api/mock/mockEditoastApi';
import generateGrantSelectProps from 'common/authorization/utils/generateGrantSelectProps';
import useSearchUsers, { type UserWithPendingGrant } from 'common/useSearchUsers';

import useSubjectsResourceGrants from '../hooks/useSubjectsResourceGrants';

type GrantsManagerSubjectsProps = {
  resourceId: number;
  resourceType: ResourceType;
  userGrant: Grant;
  privilegesByGrant: PrivilegesByGrant;
};

const GrantsManagerSubjects = ({
  resourceId,
  resourceType,
  userGrant,
  privilegesByGrant,
}: GrantsManagerSubjectsProps) => {
  const { t } = useTranslation();
  const [displayUserSearchSection, setDisplayUserSearchSection] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithPendingGrant[number]>();

  const { usersGrants, updateUserGrant } = useSubjectsResourceGrants({
    resourceId,
    resourceType,
  });

  const { searchedUsers, setSearchTerm, resetSuggestions } = useSearchUsers();

  const generateSelectProps = (selectedUserGrant?: Grant) =>
    generateGrantSelectProps({
      privilegesByGrant,
      subjectGrant: selectedUserGrant,
      connectedUserGrant: userGrant,
      t,
    });

  return (
    <>
      <div className="subject-search">
        <button
          type="button"
          className="display-search"
          onClick={() => setDisplayUserSearchSection(!displayUserSearchSection)}
        >
          {!displayUserSearchSection ? t('authorization.addGrantToUser') : t('common.cancel')}
        </button>
        {displayUserSearchSection && (
          <>
            <div className="subject-search-section">
              <span className="subject-search-combobox">
                <ComboBox
                  id="add-user-combobox"
                  value={selectedUser}
                  suggestions={searchedUsers}
                  getSuggestionLabel={(option) => option.name}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onSelectSuggestion={(suggestion) => setSelectedUser(suggestion)}
                  resetSuggestions={() => {}}
                  autoComplete="off"
                  narrow
                />
              </span>
              <span className="subject-select">
                <Select
                  id="add-user-grant-selector"
                  getOptionLabel={(option) => option.label}
                  getOptionValue={(option) => option.value || ''}
                  onChange={(option) => {
                    setSelectedUser((prev) =>
                      prev && option?.value
                        ? {
                            ...prev,
                            grant: option?.value,
                          }
                        : undefined
                    );
                  }}
                  {...generateSelectProps(selectedUser?.grant)}
                  narrow
                />
              </span>
            </div>
            <button
              type="button"
              className="subject-search-add-button"
              onClick={() => {
                if (selectedUser) {
                  updateUserGrant(selectedUser.id, selectedUser.grant);
                  resetSuggestions();
                  setSelectedUser(undefined);
                }
                setDisplayUserSearchSection(false);
              }}
            >
              {t('common.add')}
            </button>
          </>
        )}
      </div>

      <div className="subject-list">
        {usersGrants?.map(({ id, name, grant }, index) => (
          <div className="subject-card" key={id}>
            <span className={cx('subject-name', { bold: index === 0 })}>{name}</span>
            <span className="subject-select">
              <Select
                id={`${id}-${name}`}
                getOptionLabel={(option) => option.label}
                getOptionValue={(option) => option.value || ''}
                onChange={(option) => {
                  if (option?.value) updateUserGrant(id, option.value);
                }}
                {...generateSelectProps(grant)}
                narrow
              />
            </span>
          </div>
        ))}
      </div>
    </>
  );
};

export default GrantsManagerSubjects;
