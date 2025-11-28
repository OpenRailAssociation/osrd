import React from 'react';

import cx from 'classnames';

import MenuTriggerButton from 'common/MenuTriggerButton';
import type { OSRDMenuItem } from 'common/OSRDMenu';
import ResizableSection from 'common/ResizableSection';

type ResizableProps = {
  height: number;
  setHeight: React.Dispatch<React.SetStateAction<number>>;
  minHeight?: number;
};

type BoardWrapperProps = {
  children: React.ReactNode;
  customFooter?: React.ReactNode;
  hidden?: boolean;
  name: string;
  items?: OSRDMenuItem[];
  withFooter?: boolean;
  dataTestId?: string;
  resizable?: ResizableProps;
};

const BoardWrapper = ({
  children,
  hidden = false,
  name,
  items = [],
  withFooter = false,
  dataTestId,
  customFooter,
  resizable,
}: BoardWrapperProps) => {
  if (hidden) {
    return null;
  }

  const boardContent = (
    <div className="board-wrapper" data-testid={dataTestId}>
      <div className="board-header">
        <span className="board-header-name" data-testid="board-header-name">
          {name}
        </span>
        <MenuTriggerButton
          buttonProps={{
            dataTestID: 'board-header-button',
            disabled: items.length === 0,
          }}
          menuProps={{ items }}
        />
      </div>
      <div
        className={cx('board-body', {
          'with-rounded-corners': !withFooter,
        })}
      >
        {children}
      </div>
      {customFooter}
      {withFooter && !customFooter && <div className="board-footer" />}
    </div>
  );

  if (resizable) {
    return (
      <ResizableSection
        height={resizable.height}
        setHeight={resizable.setHeight}
        minHeight={resizable.minHeight}
      >
        {boardContent}
      </ResizableSection>
    );
  }

  return boardContent;
};

export default BoardWrapper;
