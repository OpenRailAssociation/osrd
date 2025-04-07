import { useState } from 'react';

import { ChevronDown, ChevronUp } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import type { ResourceType } from 'common/api/mock/mockEditoastApi';
import { GrantsLabel } from 'modules/infra/consts';
import type { GrantsLabelKeys } from 'modules/infra/type';
import { capitalizeFirstLetter } from 'utils/strings';

import GrantsManagerSubjects from './GrantsManagerSubjects';

type GrantsManagerHeaderProps = {
  resourceId: number;
  resourceType: ResourceType;
  userGrant: string;
  resourceGrants?: {
    [grant: string]: string[];
  };
};

const GrantsManagerHeader = ({
  resourceId,
  resourceType,
  userGrant,
  resourceGrants = {},
}: GrantsManagerHeaderProps) => {
  const { t } = useTranslation('grantManagement');
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
        <span className="user-infra-grant">
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
        <GrantsManagerSubjects
          resourceId={resourceId}
          resourceType={resourceType}
          userGrant={userGrant}
          resourceGrants={resourceGrants}
        />
      )}
    </div>
  );
};

export default GrantsManagerHeader;
