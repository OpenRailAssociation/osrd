import type { HTMLAttributes } from 'react';

import { People, Person } from '@osrd-project/ui-icons';
import cx from 'classnames';

import type { Subject } from '../types';

export type GrantSubjectItemProps = HTMLAttributes<HTMLSpanElement> & {
  subject: Subject;
};

export const GrantSubjectItem = ({ subject, ...props }: GrantSubjectItemProps) => (
  <span {...props} className={cx('subject-item', props.className)}>
    <span className="subject-item-icon">
      {subject.type === 'User' ? <Person size="lg" /> : <People size="lg" />}
    </span>
    <span className="subject-item-name">{subject.name}</span>
  </span>
);
