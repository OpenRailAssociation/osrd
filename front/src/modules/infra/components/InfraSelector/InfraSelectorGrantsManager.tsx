import React from 'react';

import { Select } from '@osrd-project/ui-core';
import { ChevronDown, ChevronUp } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import type { SubjectItemWithGrant } from 'common/authorization/hooks/useResourcesGrants';
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
  const [displayGrantSection, setDisplayGrantSection] = React.useState(false);
  const { t } = useTranslation('infraManagement');

  const updateUserInfraGrant = (userId: number, grant?: string) => {
    const basePayload = {
      resource_type: 'infra',
      resource_id: infraId,
      subject_id: userId,
    };

    const payload =
      !grant || grant === DEFAULT_GRANT
        ? { revoke: [basePayload] }
        : { grant: [{ ...basePayload, grant }] };

    // TODO: Add the RTK call here to post the new user's grant (& check payload structure)
    console.info('updateUserInfraGrant -- ', { payload });
  };

  return (
    <div className="infra-selector-grants-manager">
      <div className="infra-selector-grants-header">
        <span className="user-infra-grant">
          {capitalizeFirstLetter(t(`grants.${GrantsLabel[userGrant as GrantsLabelKeys]}`))}
        </span>
        <button
          type="button"
          onClick={(e) => {
            // We need that to prevent the modal to close when clicking on this section
            e.stopPropagation();
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
        <div
          className="infra-selector-subject-list"
          role="button"
          tabIndex={0}
          onClick={(e) => e.stopPropagation()}
        >
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
      )}
    </div>
  );
};

export default InfraSelectorGrantsManager;
