import { type PropsWithChildren } from 'react';

import cx from 'classnames';

import MenuTriggerButton from 'common/MenuTriggerButton';
import type { OSRDMenuItem } from 'common/OSRDMenu';
import ResizableSection, { type ResizableSectionProps } from 'common/ResizableSection';

export const BOARD_WRAPPER_HEADER_HEIGHT = 35;

type CommonProps = PropsWithChildren<{
  hidden?: boolean;
  name: string;
  items?: OSRDMenuItem[];
  withFooter?: boolean;
  dataTestId?: string;
}>;

type ResizableProps = {
  resizable: true;
} & ResizableSectionProps;

type NonResizableProps = {
  resizable?: false;
};

type BoardWrapperProps = CommonProps & (ResizableProps | NonResizableProps);

const BoardWrapper = (props: BoardWrapperProps) => {
  const { children, hidden = false, name, items = [], withFooter = false, dataTestId } = props;
  if (hidden) {
    return null;
  }

  const content = (
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

  if (props.resizable) {
    return (
      <div className="board-wrapper-resizable-section-wrapper">
        <ResizableSection
          height={props.height + BOARD_WRAPPER_HEADER_HEIGHT}
          setHeight={props.setHeight}
          minHeight={props.minHeight}
        >
          {content}
        </ResizableSection>
      </div>
    );
  }

  return content;
};

export default BoardWrapper;
