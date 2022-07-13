import React, { FC, HTMLAttributes, useState } from 'react';
import cx from 'classnames';

import './Tipped.scss';
import { CSSTransition } from 'react-transition-group';

interface TippedProps extends HTMLAttributes<any> {
  children: [JSX.Element, JSX.Element];
  tag?: keyof JSX.IntrinsicElements;
  rootTag?: keyof JSX.IntrinsicElements;
  mode?: 'bottom' | 'right' | 'left' | 'top';
}

const Tipped: FC<TippedProps> = (props) => {
  const { children, tag, rootTag, mode = 'bottom', ...attributes } = props;
  const [target, tooltip] = children;
  const [showTip, setShowTip] = useState<boolean>(false);
  const Tag = tag || 'div';
  const RootTag = rootTag || 'div';

  return (
    <RootTag
      {...(attributes || {})}
      className={cx(attributes?.className, 'tooltip-container')}
      style={{
        ...(attributes.style || {}),
        position: 'relative',
      }}
    >
      <Tag onMouseEnter={() => setShowTip(true)} onMouseLeave={() => setShowTip(false)}>
        {target}
      </Tag>
      <CSSTransition unmountOnExit in={showTip} timeout={400} classNames="transition">
        <div role="tooltip" className={cx('tooltip', 'show', `bs-tooltip-${mode}`)}>
          <div className="arrow" />
          <div className="tooltip-inner">{tooltip}</div>
        </div>
      </CSSTransition>
    </RootTag>
  );
};

export default Tipped;
