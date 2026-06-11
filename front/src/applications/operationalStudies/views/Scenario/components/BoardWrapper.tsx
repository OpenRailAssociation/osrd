import React from 'react';

import cx from 'classnames';

import MenuTriggerButton from 'common/MenuTriggerButton';
import type { OSRDMenuItem } from 'common/OSRDMenu';
import ResizableSection from 'common/ResizableSection';

const NO_ITEMS: OSRDMenuItem[] = [];

type ResizableProps = {
  height: number;
  setHeight: React.Dispatch<React.SetStateAction<number>>;
  minHeight?: number;
};

type BoardWrapperProps = {
  children: React.ReactNode;
  customHeader?: React.ReactNode;
  customFooter?: React.ReactNode;
  hidden?: boolean;
  name: string;
  fullName?: string;
  items?: OSRDMenuItem[];
  withFooter?: boolean;
  footerClass?: string;
  dataTestId?: string;
  resizable?: ResizableProps;
  ref?: React.Ref<HTMLDivElement>;
};

const BoardWrapper = ({
  children,
  hidden = false,
  name,
  fullName,
  items = NO_ITEMS,
  withFooter = false,
  footerClass,
  dataTestId,
  customHeader,
  customFooter,
  resizable,
  ref,
}: BoardWrapperProps) => {
  if (hidden) {
    return null;
  }

  const boardContent = (
    <div className="board-wrapper" data-testid={dataTestId} ref={ref}>
      <div className="board-header">
        <span className="board-header-name" data-testid="board-header-name" title={fullName}>
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
      {customHeader}
      <div
        className={cx('board-body', {
          'with-rounded-corners': !withFooter,
        })}
      >
        {children}
      </div>
      {customFooter}
      {withFooter && !customFooter && <div className={cx('board-footer', footerClass)} />}
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
