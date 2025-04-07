import { useState } from 'react';

import { ComboBox, Select } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

import type { Grant, ResourceType, SubjectItemWithGrant } from 'common/api/mock/mockEditoastApi';
import useSearchUser from 'common/useSearchUser';
import { DEFAULT_GRANT } from 'modules/infra/consts';
import generateGrantSelectProps from 'modules/infra/utils/generateGrantSelectProps';

import useOtherUsersGrants from '../hooks/useOtherUsersGrants';

type GrantsManagerSubjectsProps = {
  resourceId: number;
  resourceType: ResourceType;
  userGrant: string;
  resourceGrants?: {
    [grant: string]: string[];
  };
};

const GrantsManagerSubjects = ({
  resourceId,
  resourceType,
  userGrant,
  resourceGrants = {},
}: GrantsManagerSubjectsProps) => {
  const { t } = useTranslation('grantManagement');
  const [displayUserSearchSection, setDisplayUserSearchSection] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SubjectItemWithGrant[number] | undefined>();

  const { userSubjectsList } = useOtherUsersGrants({ resourceId, resourceType });

  const updateUserInfraGrant = (userId: number, grant?: string) => {
    const basePayload = {
      resource_type: resourceType,
      resource_id: resourceId,
      subject_id: userId,
    };

    const payload =
      grant === DEFAULT_GRANT ? { revoke: [basePayload] } : { grant: [{ ...basePayload, grant }] };

    // TODO: Add the RTK call here to post the new user's grant (& check payload structure)
    console.info('updateUserInfraGrant -- ', { payload });
  };

  const { searchResults, setSearchTerm, setSearchResults } = useSearchUser();

  const resetSuggestions = () => {
    setSearchResults([]);
    setSearchTerm('');
    setSelectedUser(undefined);
  };
  return (
    <>
      <div className="grant-manager-subject-search">
        <button
          type="button"
          className="grant-manager-display-search"
          onClick={() => setDisplayUserSearchSection(!displayUserSearchSection)}
        >
          {!displayUserSearchSection ? t('addGrantToUser') : 'Annuler'}
        </button>
        {displayUserSearchSection && (
          <>
            <div className="grant-manager-subject-search-section">
              <span className="grant-manager-subject-search-combobox">
                <ComboBox
                  id="add-user-combobox"
                  label=""
                  value={selectedUser}
                  suggestions={searchResults}
                  getSuggestionLabel={(option) => option.name}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onSelectSuggestion={(suggestion) => setSelectedUser(suggestion)}
                  resetSuggestions={() => {}}
                  autoComplete="off"
                />
              </span>
              <span className="grant-manager-subject-select">
                <Select
                  id="add-user-grant-selector"
                  label=""
                  getOptionLabel={(option) => option.label}
                  getOptionValue={(option) => option.value}
                  onChange={(option) => {
                    setSelectedUser((prev) =>
                      prev
                        ? {
                            ...prev,
                            grant: option?.value as Grant,
                          }
                        : undefined
                    );
                  }}
                  {...generateGrantSelectProps({
                    resourceGrants,
                    subjectGrant: selectedUser?.grant ?? DEFAULT_GRANT,
                    connectedUserGrant: userGrant,
                    t,
                  })}
                  narrow
                />
              </span>
            </div>
            <button
              type="button"
              className="grant-manager-subject-search-add-button align-self-end"
              onClick={() => {
                if (selectedUser) {
                  updateUserInfraGrant(selectedUser.id, selectedUser.grant);
                  resetSuggestions();
                }
                setDisplayUserSearchSection(false);
              }}
            >
              {t('actions.add')}
            </button>
          </>
        )}
      </div>

      <div className="grant-manager-subject-list">
        {userSubjectsList?.map(({ id, name, grant }) => (
          <div className="grant-manager-subject-card" key={id}>
            <span className="grant-manager-subject-name">{name}</span>
            <span className="grant-manager-subject-select">
              <Select
                id={`${id}-${name}`}
                label=""
                getOptionLabel={(option) => option.label}
                getOptionValue={(option) => option.value}
                onChange={(option) => updateUserInfraGrant(id, option?.value)}
                {...generateGrantSelectProps({
                  resourceGrants,
                  subjectGrant: grant,
                  connectedUserGrant: userGrant,
                  t,
                })}
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
