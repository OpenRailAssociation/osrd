import React, { useEffect, useMemo } from 'react';

import { Select } from '@osrd-project/ui-core';
import { ChevronDown, ChevronUp } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import { mockedEditoastApi, type GetSubjectsResponse } from 'common/api/mock/mockEditoastApi';
import { DEFAULT_GRANT, GrantsLabel } from 'modules/infra/consts';
import { capitalizeFirstLetter } from 'utils/strings';

type InfraSelectorGrantsManagerProps = {
  infraId: number;
  userInfraGrant: string;
  subjectList?: GetSubjectsResponse;
};

type GrantsLabelKeys = keyof typeof GrantsLabel;

// TODO: Recup liste des privilèges depuis customHook.
const grantPrivileges = {
  NONE: [],
  READER: ['can_read', 'can_share_read'],
  WRITER: ['can_read', 'can_share_read', 'can_write', 'can_share_write'],
  OWNER: [
    'can_read',
    'can_share_read',
    'can_write',
    'can_share_write',
    'can_delete',
    'can_share_ownership',
  ],
};

export default function InfraSelectorGrantsManager({
  infraId,
  userInfraGrant,
  subjectList = [],
}: InfraSelectorGrantsManagerProps) {
  const [displayGrantSection, setDisplayGrantSection] = React.useState(false);
  const { t } = useTranslation('infraManagement');

  const usersList = useMemo(
    () => subjectList.filter((subject) => subject.type === 'user' && subject.id !== 1), // On ignore le user connecté
    [subjectList]
  );

  const [postUsersGrantsByResourceId, { data: usersInfraGrant }] =
    mockedEditoastApi.endpoints.postUsersGrantsByResourceId.useMutation();

  useEffect(() => {
    const getUserGrantsByInfraId = async () => {
      const subjectsIdList = subjectList.map((subject) => subject.id);
      try {
        await postUsersGrantsByResourceId({
          subjects_id: subjectsIdList,
          resource_type: 'infra',
          resource_id: infraId,
        });
      } catch (error) {
        console.error(error);
      }
    };
    getUserGrantsByInfraId();
  }, [subjectList, infraId, postUsersGrantsByResourceId]);

  const usersListWithGrants = useMemo(
    () =>
      usersList.map((user) => {
        const grant =
          usersInfraGrant?.find((userGrant) => userGrant.id === user.id)?.grant || DEFAULT_GRANT;
        return { ...user, grant };
      }),
    [usersList, usersInfraGrant]
  );

  // const userPrivileges: string[] = useMemo(
  //   () => grantPrivileges[userInfraGrant as GrantsLabelKeys],
  //   [userInfraGrant]
  // );

  const options = Object.keys(GrantsLabel).reduce(
    (acc, grant) => {
      // TODO: Add a 'disable' property to the option object in the Select component
      // to display the option without allowing selection.
      // TODO: Ajouter commentaire detaillé sur la logique de disable
      const grantValue = GrantsLabel[grant as GrantsLabelKeys];
      // const requiredPrivileges: string[] = grantPrivileges[grant as GrantsLabelKeys];
      // const isDisabled = requiredPrivileges.some(
      //   (privilege) => !userPrivileges.includes(privilege) // !
      // );
      // if (isDisabled) return acc;
      acc.push({
        label: t(`grants.${grantValue}`),
        value: grant,
      });
      return acc;
    },
    [] as { label: string; value: string }[]
  );

  const updateUserInfraGrant = (userId: number, grant?: string) => {
    // TODO: Add the RTK call here to post the new user's grant (& check payload structure)
    const basePayload = {
      resource_type: 'infra',
      resource_id: infraId,
      subject_id: userId,
    };

    const payload =
      !grant || grant === DEFAULT_GRANT
        ? { revoke: [basePayload] }
        : { grant: [{ ...basePayload, grant }] };
  };

  return (
    <div
      role="button"
      tabIndex={0}
      // We need that to prevent the modal to close when clicking on this section
      onClick={(e) => e.stopPropagation()}
      className="infra-selector-grants-manager"
    >
      <div className="infra-selector-grants-header">
        <span className="user-infra-grant">
          {capitalizeFirstLetter(t(`grants.${GrantsLabel[userInfraGrant as GrantsLabelKeys]}`))}
        </span>
        <button
          type="button"
          onClick={() => {
            setDisplayGrantSection(!displayGrantSection);
          }}
        >
          {/* TODO: ajouter la couleur grise / bleue sur le texte */}
          <span>
            {displayGrantSection ? t('actions.collapse') : t('actions.details')}
            {displayGrantSection ? <ChevronUp /> : <ChevronDown />}
          </span>
        </button>
      </div>
      {displayGrantSection && (
        <div className="infra-selector-subject-list">
          {usersListWithGrants.map(({ id, name, grant }) => (
            <div className="infra-selector-subject-card" key={id}>
              <span className="infra-selector-subject-name">{name}</span>
              <span className="infra-selector-subject-grant">
                <Select
                  id={`${id}-${name}`}
                  label=""
                  value={{ label: t(`grant.${grant}`), value: grant }}
                  options={options}
                  getOptionLabel={(option) => option.label}
                  getOptionValue={(option) => option.value}
                  onChange={(option) => updateUserInfraGrant(id, option?.value)}
                />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
