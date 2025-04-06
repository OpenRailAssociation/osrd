import type { TFunction } from 'i18next';

import checkPrivileges from 'common/authorization/utils/checkPrivileges';

import { GrantsLabel } from '../consts';
import type { GrantsLabelKeys } from '../type';

const generateGrantSelectProps = ({
  resourceGrants,
  subjectGrant,
  connectedUserGrant,
  t,
}: {
  resourceGrants?:
    | {
        [grant: string]: string[];
      }
    | undefined;
  subjectGrant: string;
  connectedUserGrant: string;
  t: TFunction;
}) => {
  const currentSubjectGrantObject = {
    label: t(`grants.${GrantsLabel[subjectGrant as GrantsLabelKeys]}`),
    value: subjectGrant,
  };

  const isUserGrantGreaterThanSubject = checkPrivileges({
    resourceGrants,
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

  const options = Object.keys(GrantsLabel).reduce(
    (acc, grant) => {
      // TODO: Add a 'disable' property to the option object in the Select component once it's possible
      // to display the option without allowing selection.

      const isOptionShown = checkPrivileges({
        resourceGrants,
        userGrant: connectedUserGrant,
        requiredGrant: grant,
      });

      if (!isOptionShown) return acc;
      acc.push({
        label: t(`grants.${GrantsLabel[grant as GrantsLabelKeys]}`),
        value: grant,
      });
      return acc;
    },
    [] as { label: string; value: string }[]
  );
  return {
    value: currentSubjectGrantObject,
    options,
    readOnly: false,
  };
};

export default generateGrantSelectProps;
