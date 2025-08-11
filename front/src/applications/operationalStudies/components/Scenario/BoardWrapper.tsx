import React from 'react';

import cx from 'classnames';

import MenuTriggerButton from 'common/MenuTriggerButton';
import type { OSRDMenuItem } from 'common/OSRDMenu';

type BoardWrapperProps = {
  children: React.ReactNode;
  hidden?: boolean;
  name: string;
  items?: OSRDMenuItem[];
  withFooter?: boolean;
  dataTestId?: string;
};

const BoardWrapper = ({
  children,
  hidden = false,
  name,
  items = [],
  withFooter = false,
  dataTestId,
}: BoardWrapperProps) => {
  if (hidden) {
    return null;
  }

  return (
    <div className="board-wrapper" data-testid={dataTestId}>
      <div className="board-header">
        <span className="board-header-name" data-testid="board-header-name">
          {name}
        </span>
        <MenuTriggerButton
          buttonProps={{
            className: 'board-header-button',
            dataTestID: 'board-header-button',
            disabled: items.length === 0,
          }}
          menuProps={{ items, className: 'board-header-menu' }}
        />
      </div>
      <div
        className={cx('board-body', {
          'with-rounded-corners': !withFooter,
        })}
      >
        {children}
      </div>
      {withFooter && <div className="board-footer" />}
    </div>
  );
};

export default BoardWrapper;
