import type { TFunction } from 'i18next';

import type { Grant, PrivilegesByGrant } from 'common/api/mock/mockEditoastApi';
import checkPrivileges from 'common/authorization/utils/checkPrivileges';

import { GRANTS_LABEL } from '../consts';

const generateGrantSelectProps = ({
  privilegesByGrant,
  subjectGrant,
  connectedUserGrant,
  t,
}: {
  privilegesByGrant?: PrivilegesByGrant | undefined;
  subjectGrant?: Grant;
  connectedUserGrant: Grant;
  t: TFunction;
}) => {
  const DEFAULT_GRANT_OBJECT = {
    label: t('authorization.grants.none'),
    value: undefined,
  };
  const currentSubjectGrantObject = subjectGrant
    ? {
        label: t(`authorization.grants.${GRANTS_LABEL[subjectGrant]}`),
        value: subjectGrant,
      }
    : DEFAULT_GRANT_OBJECT;

  const isUserGrantGreaterThanSubject =
    !subjectGrant ||
    checkPrivileges({
      privilegesByGrant,
      userGrant: connectedUserGrant,
      requiredGrant: subjectGrant,
    });

  if (!isUserGrantGreaterThanSubject || connectedUserGrant === subjectGrant) {
    return {
      value: currentSubjectGrantObject,
      options: [currentSubjectGrantObject],
      readOnly: true,
    };
  }

  const options = Object.keys(GRANTS_LABEL).reduce(
    (acc, grantKey) => {
      const grant = grantKey as Grant;

      // TODO: Add a 'disable' property to the option object in the Select component once it's possible
      // to display the option without allowing selection.

      const isOptionShown = checkPrivileges({
        privilegesByGrant,
        userGrant: connectedUserGrant,
        requiredGrant: grant,
      });

      if (!isOptionShown) return acc;
      acc.push({
        label: t(`authorization.grants.${GRANTS_LABEL[grant]}`),
        value: grant,
      });
      return acc;
    },
    [] as { label: string; value: Grant }[]
  );
  return {
    value: currentSubjectGrantObject,
    options: [DEFAULT_GRANT_OBJECT, ...options],
    readOnly: false,
  };
};

export default generateGrantSelectProps;
