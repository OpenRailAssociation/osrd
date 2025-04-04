import { useState } from 'react';

import { ChevronDown, ChevronUp } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import type { Grant, PrivilegesByGrant, ResourceType } from 'common/api/mock/mockEditoastApi';
import { GRANTS_LABEL } from 'common/authorization/consts';
import { capitalizeFirstLetter } from 'utils/strings';

import GrantsManagerSubjects from './GrantsManagerSubjects';

type GrantsManagerProps = {
  resourceId: number;
  resourceType: ResourceType;
  userGrant: Grant;
  privilegesByGrant?: PrivilegesByGrant;
};

const GrantsManager = ({
  resourceId,
  resourceType,
  userGrant,
  privilegesByGrant = {
    READER: [],
    WRITER: [],
    OWNER: [],
  },
}: GrantsManagerProps) => {
  const { t } = useTranslation();
  const [displayGrantSection, setDisplayGrantSection] = useState(false);

  return (
    <div
      className="grant-manager"
      role="button"
      tabIndex={0}
      // We need that to prevent the modal to close when clicking on this section
      onClick={(e) => e.stopPropagation()}
    >
      <div className="grant-manager-header">
        <span className="user-grant">
          {t('authorization.yourGrant', {
            // TODO: remove the fallback when the backend is ready, we won't have access to resources without grant
            grant: capitalizeFirstLetter(
              t(`authorization.grants.${GRANTS_LABEL[userGrant] || 'none'}`)
            ),
          })}
        </span>
        <button
          type="button"
          onClick={() => {
            setDisplayGrantSection(!displayGrantSection);
          }}
        >
          {displayGrantSection ? (
            <span className="blue-label">
              {t('common.collapse')}
              <ChevronUp />
            </span>
          ) : (
            <span className="grey-label">
              {t('common.details')}
              <ChevronDown />
            </span>
          )}
        </button>
      </div>
      {displayGrantSection && (
        <GrantsManagerSubjects
          resourceId={resourceId}
          resourceType={resourceType}
          userGrant={userGrant}
          privilegesByGrant={privilegesByGrant}
        />
      )}
    </div>
  );
};

export default GrantsManager;
