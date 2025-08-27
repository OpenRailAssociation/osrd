import { useCallback, useEffect, useMemo, useState } from 'react';

import { Select } from '@osrd-project/ui-core';
import { Check, Alert } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import { ThreeDots } from 'common/Loaders';
import type { AsyncStatus } from 'common/types';
import { getErrorMessage } from 'utils/error';

import type { Grant, Privilege, Subject } from '../types';
import generateGrantSelectProps from '../utils/generateGrantSelectProps';

type GrantsManagerSubjectProps = {
  subject: Subject;
  subjectGrant?: Grant;
  userId: number;
  userPrivileges: Set<Privilege>;
  onChange: (grant?: Grant) => Promise<void>;
};

const GrantsManagerSubject = ({
  subject,
  subjectGrant,
  userId,
  userPrivileges,
  onChange,
}: GrantsManagerSubjectProps) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<AsyncStatus>({ type: 'idle' });

  const updateUserGrant = useCallback(
    async (grant?: Grant) => {
      setStatus({ type: 'loading' });
      try {
        await onChange(grant);
        setStatus({ type: 'success' });
      } catch (error) {
        console.error(error);
        setStatus({ type: 'error', message: getErrorMessage(error) });
      }
    },
    [onChange]
  );

  const selectProps = useMemo(
    () =>
      generateGrantSelectProps({
        subjectGrant,
        userPrivileges,
        t,
      }),
    [userPrivileges, subjectGrant, t]
  );

  useEffect(() => {
    let timer: undefined | ReturnType<typeof setTimeout>;
    if (status.type === 'success') {
      timer = setTimeout(() => {
        setStatus({ type: 'idle' });
      }, 5000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [status]);

  return (
    <div className="subject-card">
      <span className={cx('subject-name', { bold: subject.id === userId })}>
        {subject.name}
        {status.type === 'error' && <p className="text-danger">{status.message}</p>}
      </span>
      <span className="subject-grant">
        {status.type === 'loading' && <ThreeDots />}
        {status.type === 'error' && <Alert className="text-danger" />}
        {status.type === 'success' && <Check className="text-success" />}
        <Select
          id={`${subject.id}-${subject.name}`}
          label=""
          getOptionLabel={(option) => option.label}
          getOptionValue={(option) => option.value || ''}
          onChange={(option) => updateUserGrant(option?.value)}
          narrow
          {...selectProps}
        />
      </span>
    </div>
  );
};

export default GrantsManagerSubject;
