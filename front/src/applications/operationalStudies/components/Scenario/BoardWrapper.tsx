import React from 'react';

import MenuButton from 'common/MenuButton';
import type { OSRDMenuItem } from 'common/OSRDMenu';

type BoardWrapperProps = {
  children: React.ReactNode;
  visible: boolean;
  name: string;
  items?: OSRDMenuItem[];
  withFooter?: boolean;
};

const BoardWrapper = ({
  children,
  visible,
  name,
  items = [],
  withFooter = false,
}: BoardWrapperProps) => {
  if (!visible) {
    return null;
  }

  return (
    <div className="board-wrapper">
      <div className="board-header">
        <span className="board-header-name">{name}</span>
        <MenuButton
          buttonProps={{
            className: 'board-header-button',
          }}
          menuProps={{ items }}
        />
      </div>
      <div className="board-body">{children}</div>
      {withFooter && <div className="board-footer" />}
    </div>
  );
};

export default BoardWrapper;
