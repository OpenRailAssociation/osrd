import { useState } from 'react';

import { ChevronDown, ChevronUp } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import { GRANTS_LABEL } from 'common/authorization/consts';

import type { Grant, Privilege, ResourceType } from '../types';
import GrantsManagerSubjects from './GrantsManagerSubjects';

function getGrantLabel(userPrivileges: Set<Privilege>): keyof typeof GRANTS_LABEL {
  if (userPrivileges.has('can_delete')) return 'OWNER';
  if (userPrivileges.has('can_write')) return 'WRITER';
  if (userPrivileges.has('can_read')) return 'READER';
  return 'NONE';
}

type GrantsManagerProps = {
  resourceId: number;
  resourceType: ResourceType;
  userPrivileges?: Set<Privilege>;
  onChangeSuccess?: (subjectId: number, grant?: Grant) => void | Promise<void>;
};

const GrantsManager = ({
  resourceId,
  resourceType,
  userPrivileges = new Set(),
  onChangeSuccess,
}: GrantsManagerProps) => {
  const { t } = useTranslation();
  const [displayGrantSection, setDisplayGrantSection] = useState(false);

  const grantLabel = getGrantLabel(userPrivileges);

  return (
    <div className="grant-manager">
      <div className="grant-manager-header">
        <span className="user-grant">
          {t('authorization.yourGrant', {
            grant: t(`authorization.grants.${GRANTS_LABEL[grantLabel]}`),
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
