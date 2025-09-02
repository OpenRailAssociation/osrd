import { type PropsWithChildren } from 'react';

import cx from 'classnames';

import MenuTriggerButton from 'common/MenuTriggerButton';
import type { OSRDMenuItem } from 'common/OSRDMenu';
import ResizableSection, { type ResizableSectionProps } from 'common/ResizableSection';

export const BOARD_WRAPPER_HEADER_HEIGHT = 35;
export const BOARD_WRAPPER_FOOTER_HEIGHT = 16;

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
    // Height offset compensates for the space occupied by BoardWrapper's header and footer.
    // The height prop corresponds to the resizable content (board-body),
    // but ResizableSection needs to know the total height including these fixed elements.
    const heightOffset =
      BOARD_WRAPPER_HEADER_HEIGHT + (withFooter ? BOARD_WRAPPER_FOOTER_HEIGHT : 0);

    return (
      <div className="board-wrapper-resizable-section-wrapper">
        <ResizableSection
          height={props.height + heightOffset}
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
