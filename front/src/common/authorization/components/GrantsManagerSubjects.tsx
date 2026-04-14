import { useState } from 'react';

import { useTranslation } from 'react-i18next';

import generateGrantSelectProps from 'common/authorization/utils/generateGrantSelectProps';
import { LoaderFill } from 'common/Loaders';

import useAuthz from '../hooks/useAuthz';
import useResourceListSubjects from '../hooks/useResourceListUser';
import type { Grant, Privilege, ResourceType } from '../types';
import GrantManagerAddSubjectForm from './GrantManagerAddSubjectForm';
import GrantsManagerSubject from './GrantsManagerSubject';

type GrantsManagerSubjectsProps = {
  resourceId: number;
  resourceType: ResourceType;
  userPrivileges?: Set<Privilege>;
  onChangeSuccess?: (subjectId: number, grant?: Grant) => void | Promise<void>;
};

const GrantsManagerSubjects = ({
  resourceId,
  resourceType,
  userPrivileges = new Set(),
  onChangeSuccess,
}: GrantsManagerSubjectsProps) => {
  const { t } = useTranslation();
  const { userId, updateGrant } = useAuthz();
  const [displayUserSearchSection, setDisplayUserSearchSection] = useState(false);

  const { loading, subjects, refetch } = useResourceListSubjects(resourceType, resourceId);

  const generateSelectProps = (selectedUserGrant?: Grant) =>
    generateGrantSelectProps({
      subjectGrant: selectedUserGrant,
      userPrivileges,
      t,
    });

  return (
    <div
      className="grant-manager-body"
      onClick={(e) => e.stopPropagation()}
      role="button"
      tabIndex={0}
    >
      <div className="subject-search">
        <button
          type="button"
          className="display-search"
          onClick={() => setDisplayUserSearchSection(!displayUserSearchSection)}
        >
          {!displayUserSearchSection ? t('authorization.addGrantToUser') : t('common.cancel')}
        </button>
        {displayUserSearchSection && (
          <GrantManagerAddSubjectForm
            grants={generateSelectProps().options}
            onSubmit={async (user, grant) => {
              await updateGrant(resourceType, resourceId, user.id, grant);
              setDisplayUserSearchSection(false);
              // update the list of subjects
              await refetch();
            }}
          />
        )}
      </div>

      <div className="subject-list">
        {subjects?.map(({ grant, ...subject }) => (
          <GrantsManagerSubject
            key={`${subject.id}-${grant}`}
            subject={subject}
            subjectGrant={grant}
            userId={userId}
            userPrivileges={userPrivileges}
            onChange={async (value?: Grant) => {
              await updateGrant(resourceType, resourceId, subject.id, value);
              onChangeSuccess?.(subject.id, value);
            }}
          />
        ))}
        {loading && <LoaderFill />}
      </div>
    </div>
  );
};

export default GrantsManagerSubjects;
