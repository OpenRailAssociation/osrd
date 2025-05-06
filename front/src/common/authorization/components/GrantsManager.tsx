import { useState } from 'react';

import { ChevronDown, ChevronUp } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import { GRANTS_LABEL } from 'common/authorization/consts';
import { capitalizeFirstLetter } from 'utils/strings';

import type { Grant, Privilege, ResourceType } from '../types';
import GrantsManagerSubjects from './GrantsManagerSubjects';

type GrantsManagerProps = {
  resourceId: number;
  resourceType: ResourceType;
  userGrant?: Grant;
  userPrivileges?: Set<Privilege>;
  onChangeSuccess?: (subjectId: number, grant?: Grant) => void | Promise<void>;
};

const GrantsManager = ({
  resourceId,
  resourceType,
  userGrant,
  userPrivileges = new Set(),
  onChangeSuccess,
}: GrantsManagerProps) => {
  const { t } = useTranslation();
  const [displayGrantSection, setDisplayGrantSection] = useState(false);

  return (
    <div className="grant-manager">
      <div className="grant-manager-header">
        <span className="user-grant">
          {t('authorization.yourGrant', {
            grant: capitalizeFirstLetter(
              t(`authorization.grants.${GRANTS_LABEL[userGrant || 'NONE']}`)
            ),
          })}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
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
          userPrivileges={userPrivileges}
          onChangeSuccess={onChangeSuccess}
        />
      )}
    </div>
  );
};

export default GrantsManager;
