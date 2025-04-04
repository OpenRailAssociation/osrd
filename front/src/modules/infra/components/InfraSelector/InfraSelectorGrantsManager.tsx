import { useState } from 'react';

import { ComboBox, Select } from '@osrd-project/ui-core';
import { ChevronDown, ChevronUp } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import type { Grant } from 'common/api/mock/mockEditoastApi';
import type { SubjectItemWithGrant } from 'common/authorization/hooks/useResourcesGrants';
import useSearchUser from 'common/useSearchUser';
import { DEFAULT_GRANT, GrantsLabel } from 'modules/infra/consts';
import type { GrantsLabelKeys } from 'modules/infra/type';
import generateGrantSelectProps from 'modules/infra/utils/generateGrantSelectProps';
import { capitalizeFirstLetter } from 'utils/strings';

type InfraSelectorGrantsManagerProps = {
  infraId: number;
  userGrant: string;
  resourceGrants?: {
    [grant: string]: string[];
  };
  userSubjectsList: SubjectItemWithGrant;
};

const InfraSelectorGrantsManager = ({
  infraId,
  userGrant,
  resourceGrants = {},
  userSubjectsList,
}: InfraSelectorGrantsManagerProps) => {
  const [displayGrantSection, setDisplayGrantSection] = useState(false);
  const [displayUserSearchSection, setDisplayUserSearchSection] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SubjectItemWithGrant[number] | undefined>();
  const { t } = useTranslation('grantManagement');

  const updateUserInfraGrant = (userId: number, grant?: string) => {
    const basePayload = {
      resource_type: 'infra',
      resource_id: infraId,
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
    <div
      className="infra-selector-grants-manager"
      role="button"
      tabIndex={0}
      // We need that to prevent the modal to close when clicking on this section
      onClick={(e) => e.stopPropagation()}
    >
      <div className="infra-selector-grants-header">
        <span className="user-infra-grant">
          {/* {capitalizeFirstLetter(t(`grants.${GrantsLabel[userGrant as GrantsLabelKeys]}`))} */}
          {t('yourGrant', {
            grant: capitalizeFirstLetter(t(`grants.${GrantsLabel[userGrant as GrantsLabelKeys]}`)),
          })}
        </span>
        <button
          type="button"
          onClick={() => {
            setDisplayGrantSection(!displayGrantSection);
          }}
        >
          <span className={displayGrantSection ? 'blue-label' : 'grey-label'}>
            {displayGrantSection ? t('actions.collapse') : t('actions.details')}
            {displayGrantSection ? <ChevronUp /> : <ChevronDown />}
          </span>
        </button>
      </div>
      {displayGrantSection && (
        <>
          <div className="d-flex flex-column" style={{ paddingRight: '22px' }}>
            {!displayUserSearchSection && (
              <button
                type="button"
                className="align-self-start"
                style={{ padding: '0 18px', border: '1px solid grey', borderRadius: '4px' }}
                onClick={() => setDisplayUserSearchSection(!displayUserSearchSection)}
              >
                {t('addGrantToUser')}
              </button>
            )}
            {displayUserSearchSection && (
              <>
                <div className="search-user-combobox d-flex align-items-center justify-content-between">
                  <span className="">
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
                  <span className="infra-selector-subject-grant">
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
                        subjectGrant: selectedUser?.grant || DEFAULT_GRANT,
                        connectedUserGrant: userGrant,
                        t,
                      })}
                      narrow
                    />
                  </span>
                </div>
                <button
                  type="button"
                  className="align-self-end"
                  style={{ padding: '0 18px', border: '1px solid grey', borderRadius: '4px' }}
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

          <div className="infra-selector-subject-list">
            {userSubjectsList.map(({ id, name, grant }) => (
              <div className="infra-selector-subject-card" key={id}>
                <span className="infra-selector-subject-name">{name}</span>
                <span className="infra-selector-subject-grant">
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
      )}
    </div>
  );
};

export default InfraSelectorGrantsManager;
