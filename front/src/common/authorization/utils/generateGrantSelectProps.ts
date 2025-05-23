import type { TFunction } from 'i18next';

import type { Grant, Privilege } from 'common/authorization/types';

import { GRANTS_LABEL } from '../consts';

function getRequiredPrivilegesToAddGrant(grant: keyof typeof GRANTS_LABEL): Privilege[] {
  switch (grant) {
    case 'READER':
      return ['can_share_read'];
    case 'WRITER':
      return ['can_share_write'];
    case 'OWNER':
      return ['can_share_ownership'];
    // NONE means revoke, and only a owner can do that
    case 'NONE':
      return ['can_share_ownership'];
    default:
      return [];
  }
}

const generateGrantSelectProps = ({
  subjectGrant,
  userPrivileges,
  t,
}: {
  subjectGrant?: Grant;
  userPrivileges: Set<Privilege>;
  t: TFunction;
}) => {
  // List of options that the user is allowed to assign
  const allowedOptions = Object.keys(GRANTS_LABEL).reduce(
    (acc, grantKey) => {
      const grant = grantKey as keyof typeof GRANTS_LABEL;

      const requiredPrivileges = getRequiredPrivilegesToAddGrant(grant);
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

  // If the subject has no grant, we are in the case to add a new  user on the resource
  if (subjectGrant === undefined) {
    return {
      options: allowedOptions,
      readOnly: false,
    };
  }

  // Search for the subject 's option in the allowed list
  // if the subject's option is not found, we return only its grant and in readonly mode
  const subjectValueIndex = allowedOptions.findIndex((option) => option.value === subjectGrant);
  if (subjectValueIndex < 0) {
    const options = [
      {
        label: t(`authorization.grants.${GRANTS_LABEL[subjectGrant || 'NONE']}`),
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
  if (userPrivileges.has('can_share_ownership') === false) {
    const filteredOptions = allowedOptions.filter((_, index) => index >= subjectValueIndex);
    return {
      value: filteredOptions[subjectValueIndex],
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
