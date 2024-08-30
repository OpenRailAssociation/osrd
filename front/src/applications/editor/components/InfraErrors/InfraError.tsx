import React, { type PropsWithChildren } from 'react';

import cx from 'classnames';

import type { InfraError } from 'common/api/osrdEditoastApi';

import InfraErrorDescription from './InfraErrorDescription';
import InfraErrorIcon from './InfraErrorIcon';
import InfraErrorTypeLabel from './InfraErrorTypeLabel';

type InfraErrorBoxProps = PropsWithChildren<{ error: InfraError; index?: number }>;

/**
 * A component that display an infra error.
 * If index is provided, we display it with `#` on the left
 */
export const InfraErrorBox = ({ error, index, children }: InfraErrorBoxProps) => (
  <div className="management-item-content">
    <div className="management-item-symbol">
      <InfraErrorIcon error={error} />
      {index !== undefined && <span className="mt-2 text-muted">#{index}</span>}
    </div>
    <div className="management-item-main flex-grow-1">
      <h5 className="font-weight-bold">
        <InfraErrorTypeLabel error={error} />
      </h5>
      <p>
        <InfraErrorDescription error={error} />
      </p>
    </div>
    {children && <div>{children}</div>}
  </div>
);

export const InfraErrorLine = ({ error }: { error: InfraError }) => (
  <div>
    <span className={cx('font-weight-bold', error.is_warning ? 'text-warning' : 'text-danger')}>
      <InfraErrorTypeLabel error={error} />
      &nbsp;: &nbsp;
    </span>
    <InfraErrorDescription error={error} />
  </div>
);
