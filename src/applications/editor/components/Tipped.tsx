import React, { FC, HTMLAttributes, useEffect, useState } from 'react';
import cx from 'classnames';

import './Tipped.scss';

interface TippedProps extends HTMLAttributes<any> {
  children: [JSX.Element, JSX.Element];
  tag?: keyof JSX.IntrinsicElements;
  mode?: 'bottom' | 'right' | 'left' | 'top';
}

const TOLERANCE = 0.005;
const RATIO = 0.2;

const Tipped: FC<TippedProps> = (props) => {
  const { children, tag, mode = 'bottom', ...attributes } = props;
  const [target, tooltip] = children;
  const [showTip, setShowTip] = useState<boolean>(false);
  const [opacity, setOpacity] = useState<number>(0);
  const Tag = tag || 'div';

  useEffect(() => {
    const id = setInterval(() => {
      const target = showTip ? 1 : 0;
      let newOpacity = target * RATIO + opacity * (1 - RATIO);

      if (Math.abs(target - newOpacity) < TOLERANCE) newOpacity = target;
      setOpacity(newOpacity);
    }, 10);

    return () => clearInterval(id);
  }, [showTip, opacity, setOpacity]);

  return (
    <Tag
      {...(attributes || {})}
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
      className={cx(attributes?.className, 'tooltip-container')}
      style={{
        ...(attributes.style || {}),
        position: 'relative',
      }}
    >
      {target}
      {!!opacity && (
        <div
          role="tooltip"
          style={{ opacity }}
          className={cx('tooltip', 'show', `bs-tooltip-${mode}`)}
        >
          <div className="arrow" />
          <div className="tooltip-inner">{tooltip}</div>
        </div>
      )}
    </Tag>
  );
};

export default Tipped;
