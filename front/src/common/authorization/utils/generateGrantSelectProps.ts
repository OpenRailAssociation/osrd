import type { TFunction } from 'i18next';

import type { Grant, Privilege, ResourceType } from 'common/authorization/types';

import { GRANTS_LABEL, RESOURCE_TYPE_ALLOWED_GRANTS } from '../consts';

// Privilege that grants ownership over the resource, used to add/revoke the OWNER/NONE grants
function getOwnerPrivilege(resourceType: ResourceType): Privilege {
  return resourceType === 'project' ? 'has_access' : 'can_share_ownership';
}

function getRequiredPrivilegesToAddGrant(
  grant: keyof typeof GRANTS_LABEL,
  resourceType: ResourceType
): Privilege[] {
  switch (grant) {
    case 'RESTRICTED_READER':
      return ['can_share_read'];
    case 'READER':
      return ['can_share_read'];
    case 'WRITER':
      return ['can_share_write'];
    case 'OWNER':
      return [getOwnerPrivilege(resourceType)];
    // NONE means revoke, and only a owner can do that
    case 'NONE':
      return [getOwnerPrivilege(resourceType)];
    default:
      return [];
  }
}

const generateGrantSelectProps = ({
  subjectGrant,
  userPrivileges,
  resourceType,
  t,
}: {
  subjectGrant?: Grant;
  userPrivileges: Set<Privilege>;
  resourceType: ResourceType;
  t: TFunction;
}) => {
  // Some resource types (eg. project) only expose a subset of the grants
  const grantsForResource = RESOURCE_TYPE_ALLOWED_GRANTS[resourceType];

  // List of options that the user is allowed to assign
  const allowedOptions = Object.keys(GRANTS_LABEL).reduce(
    (acc, grantKey) => {
      const grant = grantKey as keyof typeof GRANTS_LABEL;

      if (grantsForResource && !grantsForResource.includes(grant)) return acc;

      const requiredPrivileges = getRequiredPrivilegesToAddGrant(grant, resourceType);
      const isOptionShown = requiredPrivileges.every((privilege) => userPrivileges.has(privilege));
      if (isOptionShown) {
        acc.push({
          label: t(`authorization.grants.${GRANTS_LABEL[grant]}`),
          value: grant !== 'NONE' ? grant : undefined,
        });
      }
      return acc;
    },
    [] as Array<{ label: string; value?: Grant }>
  );

  // If the subject has no grant, we are in the case to add a new user on the resource
  // Revoking access makes no sense here since the subject already has none
  if (subjectGrant === undefined) {
    return {
      options: allowedOptions.filter((option) => option.value !== undefined),
      readOnly: false,
    };
  }

  // Search for the subject's option in the allowed list
  // if the subject's option is not found, we return only its grant and in readonly mode
  const subjectValueIndex = allowedOptions.findIndex((option) => option.value === subjectGrant);
  if (subjectValueIndex < 0) {
    const options = [
      {
        label: t(`authorization.grants.${GRANTS_LABEL[subjectGrant]}`),
        value: subjectGrant,
      },
    ];
    return {
      value: options[0],
      options,
      readOnly: true,
    };
  }

  // In case of not owner of the resource, we need to remove all options below the subject one.
  // A user can't revoke a grant if he is not owner
  if (!userPrivileges.has(getOwnerPrivilege(resourceType))) {
    const filteredOptions = allowedOptions.filter((_, index) => index >= subjectValueIndex);
    return {
      value: allowedOptions[subjectValueIndex],
      options: filteredOptions,
      // readonly if there is only one option left and it is already selected
      readOnly: filteredOptions.length === 1,
    };
  }

  return {
    value: allowedOptions[subjectValueIndex],
    options: allowedOptions,
    readOnly: false,
  };
};

export default generateGrantSelectProps;
