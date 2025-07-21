import React from 'react';

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
        <span className="board-header-name">{name}</span>
        <MenuTriggerButton
          buttonProps={{
            className: 'board-header-button',
            disabled: items.length === 0,
          }}
          menuProps={{ items, className: 'board-header-menu' }}
        />
      </div>
      <div className="board-body">{children}</div>
      {withFooter && <div className="board-footer" />}
    </div>
  );
};

export default BoardWrapper;
