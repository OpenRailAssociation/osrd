import React, { type FC, type HTMLAttributes, useState } from 'react';

import cx from 'classnames';
import { CSSTransition } from 'react-transition-group';

interface TippedProps extends HTMLAttributes<unknown> {
  children: [JSX.Element, JSX.Element];
  tag?: keyof JSX.IntrinsicElements;
  rootTag?: keyof JSX.IntrinsicElements;
  mode?: 'bottom' | 'right' | 'left' | 'top';
  disableTooltip?: boolean;
}

const Tipped: FC<TippedProps> = (props) => {
  const { children, tag, rootTag, mode = 'bottom', disableTooltip, ...attributes } = props;
  const [target, tooltip] = children;
  const [showTip, setShowTip] = useState<boolean>(false);
  const Tag = tag || 'div';
  const RootTag = rootTag || 'div';

  return (
    <RootTag
      {...(attributes || {})}
      className={cx(attributes?.className, 'tipped-tooltip-container')}
      style={{
        ...(attributes.style || {}),
        position: 'relative',
      }}
    >
      <Tag
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        onPointerLeave={() => setShowTip(false)}
      >
        {target}
      </Tag>
      {!disableTooltip && (
        <CSSTransition unmountOnExit in={showTip} timeout={400} classNames="transition">
          <div role="tooltip" className={cx('tooltip', 'show', `bs-tooltip-${mode}`)}>
            <div className="arrow" />
            <div className="tooltip-inner">{tooltip}</div>
          </div>
        </CSSTransition>
      )}
    </RootTag>
  );
};

export default Tipped;
